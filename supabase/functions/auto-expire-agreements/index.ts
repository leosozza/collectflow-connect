import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const oneDayAgoStr = oneDayAgo.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  try {
    // 1. Mark as overdue: pending/approved with first_due_date < 1 day ago
    const { data: toOverdue, error: err1 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf")
      .in("status", ["pending", "approved"])
      .lt("first_due_date", oneDayAgoStr);

    if (err1) throw err1;

    if (toOverdue && toOverdue.length > 0) {
      const ids = toOverdue.map((a: any) => a.id);
      await supabase
        .from("agreements")
        .update({ status: "overdue" })
        .in("id", ids);

      const notifications = toOverdue.map((a: any) => ({
        tenant_id: a.tenant_id,
        user_id: a.created_by,
        title: "Acordo vencido",
        message: `O acordo de ${a.client_name} (${a.client_cpf}) está vencido.`,
        type: "warning",
        reference_type: "agreement",
        reference_id: a.id,
      }));
      await supabase.from("notifications").insert(notifications);
    }

    // 2. Cancel overdue agreements based on credor's prazo_dias_acordo
    const { data: overdueAgreements, error: err2 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf, credor, first_due_date")
      .eq("status", "overdue");

    if (err2) throw err2;

    let cancelledCount = 0;

    if (overdueAgreements && overdueAgreements.length > 0) {
      // Get unique credor names + tenant combos
      const credorKeys = [...new Set(overdueAgreements.map((a: any) => `${a.tenant_id}|${a.credor}`))];
      const tenantIds = [...new Set(overdueAgreements.map((a: any) => a.tenant_id))];

      const { data: credores } = await supabase
        .from("credores")
        .select("razao_social, nome_fantasia, tenant_id, prazo_dias_acordo")
        .in("tenant_id", tenantIds);

      // Build lookup: "tenant_id|credor_name" -> prazo_dias_acordo
      const prazoMap: Record<string, number | null> = {};
      if (credores) {
        for (const c of credores) {
          if (c.razao_social) prazoMap[`${c.tenant_id}|${c.razao_social}`] = c.prazo_dias_acordo;
          if (c.nome_fantasia) prazoMap[`${c.tenant_id}|${c.nome_fantasia}`] = c.prazo_dias_acordo;
        }
      }

      const toCancel: any[] = [];
      for (const a of overdueAgreements) {
        const prazo = prazoMap[`${a.tenant_id}|${a.credor}`];
        // If prazo is null/0, do NOT auto-cancel
        if (!prazo || prazo <= 0) continue;

        const dueDate = new Date(a.first_due_date);
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= prazo) {
          toCancel.push(a);
        }
      }

      if (toCancel.length > 0) {
        const ids = toCancel.map((a: any) => a.id);
        await supabase
          .from("agreements")
          .update({ status: "cancelled" })
          .in("id", ids);

        // Revert client records from em_acordo → pendente and set "Quebra de Acordo" status
        // Get "Quebra de Acordo" status ID
        const tenantIdsForCancel = [...new Set(toCancel.map((a: any) => a.tenant_id))];
        const { data: quebraStatusList } = await supabase
          .from("tipos_status")
          .select("id, tenant_id")
          .eq("nome", "Quebra de Acordo")
          .in("tenant_id", tenantIdsForCancel);

        const quebraStatusByTenant: Record<string, string> = {};
        (quebraStatusList || []).forEach((s: any) => {
          quebraStatusByTenant[s.tenant_id] = s.id;
        });

        for (const a of toCancel) {
          const quebraId = quebraStatusByTenant[a.tenant_id];
          const updateData: any = { status: "pendente" };
          if (quebraId) {
            updateData.status_cobranca_id = quebraId;
          }
          await supabase
            .from("clients")
            .update(updateData)
            .eq("status", "em_acordo")
            .eq("cpf", a.client_cpf)
            .eq("tenant_id", a.tenant_id);
        }

        const notifications = toCancel.map((a: any) => {
          const prazo = prazoMap[`${a.tenant_id}|${a.credor}`];
          return {
            tenant_id: a.tenant_id,
            user_id: a.created_by,
            title: "Acordo cancelado automaticamente",
            message: `O acordo de ${a.client_name} (${a.client_cpf}) foi cancelado após ${prazo} dias de vencimento.`,
            type: "error",
            reference_type: "agreement",
            reference_id: a.id,
          };
        });
        await supabase.from("notifications").insert(notifications);
        cancelledCount = toCancel.length;
      }
    }

    // 3. Mark overdue client installments: pendente + data_vencimento < today → vencido
    const { error: err3 } = await supabase
      .from("clients")
      .update({ status: "vencido" })
      .eq("status", "pendente")
      .lt("data_vencimento", todayStr);

    if (err3) throw err3;

    return new Response(
      JSON.stringify({
        overdue: toOverdue?.length || 0,
        cancelled: cancelledCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
