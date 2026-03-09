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

    if (!emDiaId || !aguardandoId) {
      return new Response(
        JSON.stringify({ error: "Status 'Em dia' ou 'Aguardando acionamento' não encontrados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Find pending clients with "Em dia" status but overdue → change to "Aguardando acionamento"
    const { data: overdueClients, error: err1 } = await supabase
      .from("clients")
      .update({ status_cobranca_id: aguardandoId })
      .eq("status", "pendente")
      .eq("status_cobranca_id", emDiaId)
      .lt("data_vencimento", today)
      .select("id");

    const overdueCount = overdueClients?.length || 0;

    // 3. Find pending clients with "Aguardando acionamento" but all parcels are future → change to "Em dia"
    // This requires grouping by CPF+credor, so we need to fetch and process
    const { data: aguardandoClients } = await supabase
      .from("clients")
      .select("id, cpf, credor, data_vencimento, status, status_cobranca_id")
      .eq("status", "pendente")
      .eq("status_cobranca_id", aguardandoId);

    // Group by CPF+credor
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

    // 4. Set "Em dia" for pending clients that have NO status_cobranca_id and are not overdue
    const { data: noStatusClients } = await supabase
      .from("clients")
      .update({ status_cobranca_id: emDiaId })
      .eq("status", "pendente")
      .is("status_cobranca_id", null)
      .gte("data_vencimento", today)
      .select("id");

    // 5. Set "Aguardando acionamento" for pending clients with no status that ARE overdue
    const { data: noStatusOverdue } = await supabase
      .from("clients")
      .update({ status_cobranca_id: aguardandoId })
      .eq("status", "pendente")
      .is("status_cobranca_id", null)
      .lt("data_vencimento", today)
      .select("id");

    return new Response(
      JSON.stringify({
        success: true,
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
