import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Build the virtual payment schedule for an agreement,
 * respecting custom_installment_dates and custom_installment_values.
 */
function buildSchedule(a: any): { date: string; amount: number; cumulative: number }[] {
  const schedule: { date: string; amount: number; cumulative: number }[] = [];
  const customDates: Record<string, string> = (a.custom_installment_dates as any) || {};
  const customValues: Record<string, number> = (a.custom_installment_values as any) || {};
  let cumulative = 0;
  const hasEntrada = (a.entrada_value ?? 0) > 0;

  // Entrada
  if (hasEntrada) {
    const entradaDate = a.entrada_date || a.first_due_date;
    const entradaAmount = customValues["entrada"] ?? a.entrada_value;
    cumulative += entradaAmount;
    schedule.push({ date: entradaDate, amount: entradaAmount, cumulative });
  }

  // Regular installments
  for (let i = 0; i < a.new_installments; i++) {
    const instNum = (hasEntrada ? 1 : 0) + i + 1;

    // Date: custom or calculated
    let dueDateStr: string;
    if (customDates[String(instNum)]) {
      dueDateStr = customDates[String(instNum)];
    } else {
      const dueDate = new Date(a.first_due_date + "T12:00:00Z");
      dueDate.setMonth(dueDate.getMonth() + i);
      dueDateStr = dueDate.toISOString().split("T")[0];
    }

    // Value: custom or default
    const amount = customValues[String(instNum)] ?? a.new_installment_value;
    cumulative += amount;
    schedule.push({ date: dueDateStr, amount, cumulative });
  }

  schedule.sort((a, b) => a.date.localeCompare(b.date));
  return schedule;
}

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
    // 1. Bidirectional status reconciliation
    //    pending ↔ overdue based on actual payments
    // =============================================

    const { data: activeAgreements, error: err1 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf, credor, first_due_date, entrada_value, entrada_date, new_installments, new_installment_value, proposed_total, status, custom_installment_dates, custom_installment_values")
      .in("status", ["pending", "approved", "overdue"]);

    if (err1) throw err1;

    const toOverdue: any[] = [];
    const toPending: any[] = [];

    if (activeAgreements && activeAgreements.length > 0) {
      for (const a of activeAgreements) {
        // Skip approved (fully paid) — don't touch
        if (a.status === "approved") continue;

        const schedule = buildSchedule(a);
        const pastDueEntries = schedule.filter(s => s.date < todayStr);

        if (pastDueEntries.length === 0) {
          // No past-due entries — should be pending
          if (a.status === "overdue") {
            toPending.push(a);
          }
          continue;
        }

        const expectedPaid = pastDueEntries[pastDueEntries.length - 1].cumulative;

        // Normalize CPF for matching (DB may store with dots/dashes)
        const rawCpf = (a.client_cpf || "").replace(/[.\-]/g, "");
        const fmtCpf = rawCpf.length === 11
          ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
          : rawCpf;

        const { data: clientRecords } = await supabase
          .from("clients")
          .select("valor_pago")
          .eq("tenant_id", a.tenant_id)
          .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf},cpf.eq.${a.client_cpf}`);

        const totalPaid = (clientRecords || []).reduce((sum: number, c: any) => sum + (c.valor_pago || 0), 0);

        const isOverdue = totalPaid < expectedPaid - 0.01;

        if (isOverdue && a.status === "pending") {
          toOverdue.push(a);
        } else if (!isOverdue && a.status === "overdue") {
          toPending.push(a);
        }
      }

      // Apply pending → overdue
      if (toOverdue.length > 0) {
        const ids = toOverdue.map((a: any) => a.id);
        await supabase.from("agreements").update({ status: "overdue" }).in("id", ids);

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

      // Apply overdue → pending (regularized)
      if (toPending.length > 0) {
        const ids = toPending.map((a: any) => a.id);
        await supabase.from("agreements").update({ status: "pending" }).in("id", ids);
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

        const earliestDue = (a.entrada_value > 0 && a.entrada_date) ? a.entrada_date : a.first_due_date;
        const dueDate = new Date(earliestDue);
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= prazo) {
          toCancel.push(a);
        }
      }

      if (toCancel.length > 0) {
        const ids = toCancel.map((a: any) => a.id);
        await supabase.from("agreements").update({ status: "cancelled" }).in("id", ids);

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
          const rawCpf = (a.client_cpf || "").replace(/[.\-]/g, "");
          const fmtCpf = rawCpf.length === 11
            ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
            : rawCpf;
          await supabase
            .from("clients")
            .update(updateData)
            .eq("status", "em_acordo")
            .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf},cpf.eq.${a.client_cpf}`)
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
        regularized: toPending?.length || 0,
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
