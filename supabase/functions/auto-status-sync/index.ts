import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract tenant_id from body (required)
    let tenant_id: string | null = null;
    try {
      const body = await req.json();
      tenant_id = body?.tenant_id || null;
    } catch {
      // No body or invalid JSON
    }

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    // 1. Get status IDs for this tenant
    const { data: statusList } = await supabase
      .from("tipos_status")
      .select("id, nome, regras")
      .eq("tenant_id", tenant_id);

    const statusMap = new Map<string, string>();
    const statusRegras = new Map<string, any>();
    (statusList || []).forEach((s: any) => {
      statusMap.set(s.nome, s.id);
      statusRegras.set(s.nome, s.regras || {});
    });

    const emDiaId = statusMap.get("Em dia");
    const aguardandoId = statusMap.get("Aguardando acionamento");
    const acordoVigenteId = statusMap.get("Acordo Vigente");
    const quebraAcordoId = statusMap.get("Quebra de Acordo");
    const quitadoId = statusMap.get("Quitado");
    const emNegociacaoId = statusMap.get("Em negociação");

    if (!emDiaId || !aguardandoId) {
      return new Response(
        JSON.stringify({ error: "Status 'Em dia' ou 'Aguardando acionamento' não encontrados para este tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const counts: Record<string, number> = {};

    // 2. Clients with status 'em_acordo' → force "Acordo Vigente"
    if (acordoVigenteId) {
      const { data: d1 } = await supabase
        .from("clients")
        .update({ status_cobranca_id: acordoVigenteId })
        .eq("tenant_id", tenant_id)
        .eq("status", "em_acordo")
        .neq("status_cobranca_id", acordoVigenteId)
        .select("id");

      const { data: d2 } = await supabase
        .from("clients")
        .update({ status_cobranca_id: acordoVigenteId })
        .eq("tenant_id", tenant_id)
        .eq("status", "em_acordo")
        .is("status_cobranca_id", null)
        .select("id");

      counts.acordo_vigente = (d1?.length || 0) + (d2?.length || 0);
    }

    // 3. Clients with status 'quebrado' → force "Quebra de Acordo"
    if (quebraAcordoId) {
      const { data: d1 } = await supabase
        .from("clients")
        .update({ status_cobranca_id: quebraAcordoId })
        .eq("tenant_id", tenant_id)
        .eq("status", "quebrado")
        .neq("status_cobranca_id", quebraAcordoId)
        .select("id");

      const { data: d2 } = await supabase
        .from("clients")
        .update({ status_cobranca_id: quebraAcordoId })
        .eq("tenant_id", tenant_id)
        .eq("status", "quebrado")
        .is("status_cobranca_id", null)
        .select("id");

      counts.quebra_acordo = (d1?.length || 0) + (d2?.length || 0);
    }

    // 4. Clients with status 'pago' → force "Quitado"
    if (quitadoId) {
      const { data: d1 } = await supabase
        .from("clients")
        .update({ status_cobranca_id: quitadoId })
        .eq("tenant_id", tenant_id)
        .eq("status", "pago")
        .neq("status_cobranca_id", quitadoId)
        .select("id");

      const { data: d2 } = await supabase
        .from("clients")
        .update({ status_cobranca_id: quitadoId })
        .eq("tenant_id", tenant_id)
        .eq("status", "pago")
        .is("status_cobranca_id", null)
        .select("id");

      counts.quitado = (d1?.length || 0) + (d2?.length || 0);
    }

    // 5. Overdue clients (pendente/vencido) with "Em dia" → "Aguardando acionamento"
    const { data: overdueClients } = await supabase
      .from("clients")
      .update({ status_cobranca_id: aguardandoId })
      .eq("tenant_id", tenant_id)
      .in("status", ["pendente", "vencido"])
      .eq("status_cobranca_id", emDiaId)
      .lt("data_vencimento", today)
      .select("id");

    counts.overdue_to_aguardando = overdueClients?.length || 0;

    // 6. "Aguardando acionamento" clients where ALL parcels are future → "Em dia"
    const { data: aguardandoClients } = await supabase
      .from("clients")
      .select("id, cpf, credor, data_vencimento, status, status_cobranca_id")
      .eq("tenant_id", tenant_id)
      .in("status", ["pendente", "vencido"])
      .eq("status_cobranca_id", aguardandoId);

    const groups = new Map<string, any[]>();
    (aguardandoClients || []).forEach((c: any) => {
      const key = `${c.cpf}|${c.credor}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });

    const idsToEmDia: string[] = [];
    groups.forEach((group) => {
      const allFutureAndPendente = group.every(
        (c: any) => c.data_vencimento >= today && c.status === "pendente"
      );
      if (allFutureAndPendente) {
        group.forEach((c: any) => idsToEmDia.push(c.id));
      }
    });

    if (idsToEmDia.length > 0) {
      for (let i = 0; i < idsToEmDia.length; i += 100) {
        const batch = idsToEmDia.slice(i, i + 100);
        await supabase
          .from("clients")
          .update({ status_cobranca_id: emDiaId })
          .in("id", batch);
      }
    }
    counts.aguardando_to_emdia = idsToEmDia.length;

    // 7. Pending clients with no status_cobranca_id and not overdue → "Em dia"
    const { data: noStatusClients } = await supabase
      .from("clients")
      .update({ status_cobranca_id: emDiaId })
      .eq("tenant_id", tenant_id)
      .eq("status", "pendente")
      .is("status_cobranca_id", null)
      .gte("data_vencimento", today)
      .select("id");

    counts.new_emdia = noStatusClients?.length || 0;

    // 8. Pending/vencido clients with no status that ARE overdue → "Aguardando acionamento"
    const { data: noStatusOverdue } = await supabase
      .from("clients")
      .update({ status_cobranca_id: aguardandoId })
      .eq("tenant_id", tenant_id)
      .in("status", ["pendente", "vencido"])
      .is("status_cobranca_id", null)
      .lt("data_vencimento", today)
      .select("id");

    counts.new_aguardando = noStatusOverdue?.length || 0;

    // 9. Expire "Em negociação"
    if (emNegociacaoId) {
      const regras = statusRegras.get("Em negociação") || {};
      const expiracaoDias = regras.tempo_expiracao_dias || 10;
      const autoTransicaoNome = regras.auto_transicao || "Aguardando acionamento";
      const targetId = statusMap.get(autoTransicaoNome) || aguardandoId;

      const { data: negociacaoClients } = await supabase
        .from("clients")
        .select("id, status_cobranca_locked_at")
        .eq("tenant_id", tenant_id)
        .eq("status_cobranca_id", emNegociacaoId);

      const idsToExpire: string[] = [];
      (negociacaoClients || []).forEach((c: any) => {
        if (c.status_cobranca_locked_at) {
          const lockedAt = new Date(c.status_cobranca_locked_at);
          const diffDays = Math.floor((now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= expiracaoDias) {
            idsToExpire.push(c.id);
          }
        }
      });

      if (idsToExpire.length > 0) {
        for (let i = 0; i < idsToExpire.length; i += 100) {
          const batch = idsToExpire.slice(i, i + 100);
          await supabase
            .from("clients")
            .update({
              status_cobranca_id: targetId,
              status_cobranca_locked_by: null,
              status_cobranca_locked_at: null,
            })
            .in("id", batch);
        }
      }
      counts.negociacao_expirada = idsToExpire.length;
    }

    return new Response(
      JSON.stringify({ success: true, tenant_id, ...counts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
