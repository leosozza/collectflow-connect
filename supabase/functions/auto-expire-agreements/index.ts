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
  const todayStr = now.toISOString().split("T")[0];

  try {
    // =============================================
    // 1. Mark agreements as OVERDUE
    // An agreement is overdue when its earliest unpaid due date < today
    // We consider: entrada_date (if exists) and virtual installments
    // =============================================

    const { data: activeAgreements, error: err1 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf, credor, first_due_date, entrada_value, entrada_date, new_installments, new_installment_value, proposed_total, status")
      .in("status", ["pending", "approved"]);

    if (err1) throw err1;

    const toOverdue: any[] = [];

    if (activeAgreements && activeAgreements.length > 0) {
      // For each agreement, calculate the earliest unpaid due date
      // Then cross-reference with clients.valor_pago to see if it's been paid
      for (const a of activeAgreements) {
        // Build virtual payment schedule
        const schedule: { date: string; amount: number; cumulative: number }[] = [];
        let cumulative = 0;

        // Entrada (if exists)
        if (a.entrada_value && a.entrada_value > 0) {
          const entradaDate = a.entrada_date || a.first_due_date;
          cumulative += a.entrada_value;
          schedule.push({ date: entradaDate, amount: a.entrada_value, cumulative });
        }

        // Regular installments
        for (let i = 0; i < a.new_installments; i++) {
          const dueDate = new Date(a.first_due_date + "T12:00:00Z");
          dueDate.setMonth(dueDate.getMonth() + i);
          const dueDateStr = dueDate.toISOString().split("T")[0];
          cumulative += a.new_installment_value;
          schedule.push({ date: dueDateStr, amount: a.new_installment_value, cumulative });
        }

        // Sort by date
        schedule.sort((a, b) => a.date.localeCompare(b.date));

        // Find the earliest due date that is past today
        const pastDueEntries = schedule.filter(s => s.date < todayStr);
        if (pastDueEntries.length === 0) continue; // No past due entries

        // Get total amount that should have been paid by now
        const expectedPaid = pastDueEntries[pastDueEntries.length - 1].cumulative;

        // Get actual valor_pago from clients table for this CPF + tenant + em_acordo status
        const { data: clientRecords } = await supabase
          .from("clients")
          .select("valor_pago")
          .eq("tenant_id", a.tenant_id)
          .eq("cpf", a.client_cpf)
          .eq("status", "em_acordo");

        const totalPaid = (clientRecords || []).reduce((sum: number, c: any) => sum + (c.valor_pago || 0), 0);

        // If total paid < expected cumulative amount for past-due dates, mark as overdue
        if (totalPaid < expectedPaid - 0.01) {
          toOverdue.push(a);
        }
      }

      if (toOverdue.length > 0) {
        // Only mark "pending" agreements as overdue (not "approved" which means paid)
        const pendingOverdue = toOverdue.filter(a => a.status === "pending");
        if (pendingOverdue.length > 0) {
          const ids = pendingOverdue.map((a: any) => a.id);
          await supabase
            .from("agreements")
            .update({ status: "overdue" })
            .in("id", ids);

          const notifications = pendingOverdue.map((a: any) => ({
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
      }
    }

    // =============================================
    // 2. Cancel overdue agreements based on credor's prazo_dias_acordo
    // =============================================
    const { data: overdueAgreements, error: err2 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf, credor, first_due_date, entrada_date, entrada_value")
      .eq("status", "overdue");

    if (err2) throw err2;

    let cancelledCount = 0;

    if (overdueAgreements && overdueAgreements.length > 0) {
      const tenantIds = [...new Set(overdueAgreements.map((a: any) => a.tenant_id))];

      const { data: credores } = await supabase
        .from("credores")
        .select("razao_social, nome_fantasia, tenant_id, prazo_dias_acordo")
        .in("tenant_id", tenantIds);

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
        if (!prazo || prazo <= 0) continue;

        // Calculate earliest due date (entrada or first installment)
        const earliestDue = (a.entrada_value > 0 && a.entrada_date) ? a.entrada_date : a.first_due_date;
        const dueDate = new Date(earliestDue);
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

        // Revert client records
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
          const p = prazoMap[`${a.tenant_id}|${a.credor}`];
          return {
            tenant_id: a.tenant_id,
            user_id: a.created_by,
            title: "Acordo cancelado automaticamente",
            message: `O acordo de ${a.client_name} (${a.client_cpf}) foi cancelado após ${p} dias de vencimento.`,
            type: "error",
            reference_type: "agreement",
            reference_id: a.id,
          };
        });
        await supabase.from("notifications").insert(notifications);
        cancelledCount = toCancel.length;
      }
    }

    // =============================================
    // 3. Mark overdue client installments
    // =============================================
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
