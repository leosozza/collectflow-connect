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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split("T")[0];

    // 1. Get status IDs
    const { data: statusList } = await supabase
      .from("tipos_status")
      .select("id, nome");

    const statusMap = new Map<string, string>();
    (statusList || []).forEach((s: any) => statusMap.set(s.nome, s.id));

    const emDiaId = statusMap.get("Em dia");
    const aguardandoId = statusMap.get("Aguardando acionamento");
    const acordoVigenteId = statusMap.get("Acordo Vigente");

    if (!emDiaId || !aguardandoId) {
      return new Response(
        JSON.stringify({ error: "Status 'Em dia' ou 'Aguardando acionamento' não encontrados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Clients with status 'em_acordo' → force "Acordo Vigente"
    let acordoVigenteCount = 0;
    if (acordoVigenteId) {
      const { data: acordoClients } = await supabase
        .from("clients")
        .update({ status_cobranca_id: acordoVigenteId })
        .eq("status", "em_acordo")
        .neq("status_cobranca_id", acordoVigenteId)
        .select("id");

      // Also set for em_acordo clients with null status_cobranca_id
      const { data: acordoNullClients } = await supabase
        .from("clients")
        .update({ status_cobranca_id: acordoVigenteId })
        .eq("status", "em_acordo")
        .is("status_cobranca_id", null)
        .select("id");

      acordoVigenteCount = (acordoClients?.length || 0) + (acordoNullClients?.length || 0);
    }

    // 3. Overdue clients (pendente/vencido) with "Em dia" → change to "Aguardando acionamento"
    const { data: overdueClients } = await supabase
      .from("clients")
      .update({ status_cobranca_id: aguardandoId })
      .in("status", ["pendente", "vencido"])
      .eq("status_cobranca_id", emDiaId)
      .lt("data_vencimento", today)
      .select("id");

    const overdueCount = overdueClients?.length || 0;

    // 4. Clients with "Aguardando acionamento" but ALL parcels are future → change to "Em dia"
    const { data: aguardandoClients } = await supabase
      .from("clients")
      .select("id, cpf, credor, data_vencimento, status, status_cobranca_id")
      .in("status", ["pendente"])
      .eq("status_cobranca_id", aguardandoId);

    const groups = new Map<string, any[]>();
    (aguardandoClients || []).forEach((c: any) => {
      const key = `${c.cpf}|${c.credor}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });

    const idsToEmDia: string[] = [];
    groups.forEach((group) => {
      const allFuture = group.every((c: any) => c.data_vencimento >= today);
      if (allFuture) {
        group.forEach((c: any) => idsToEmDia.push(c.id));
      }
    });

    let emDiaCount = 0;
    if (idsToEmDia.length > 0) {
      for (let i = 0; i < idsToEmDia.length; i += 100) {
        const batch = idsToEmDia.slice(i, i + 100);
        await supabase
          .from("clients")
          .update({ status_cobranca_id: emDiaId })
          .in("id", batch);
      }
      emDiaCount = idsToEmDia.length;
    }

    // 5. Pending clients with no status_cobranca_id and not overdue → "Em dia"
    const { data: noStatusClients } = await supabase
      .from("clients")
      .update({ status_cobranca_id: emDiaId })
      .eq("status", "pendente")
      .is("status_cobranca_id", null)
      .gte("data_vencimento", today)
      .select("id");

    // 6. Pending/vencido clients with no status that ARE overdue → "Aguardando acionamento"
    const { data: noStatusOverdue } = await supabase
      .from("clients")
      .update({ status_cobranca_id: aguardandoId })
      .in("status", ["pendente", "vencido"])
      .is("status_cobranca_id", null)
      .lt("data_vencimento", today)
      .select("id");

    return new Response(
      JSON.stringify({
        success: true,
        acordo_vigente: acordoVigenteCount,
        overdue_to_aguardando: overdueCount,
        aguardando_to_emdia: emDiaCount,
        new_emdia: noStatusClients?.length || 0,
        new_aguardando: noStatusOverdue?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
