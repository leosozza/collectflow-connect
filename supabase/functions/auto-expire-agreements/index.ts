import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSchedule(a: any): { date: string; amount: number; cumulative: number }[] {
  const schedule: { date: string; amount: number; cumulative: number }[] = [];
  const customDates: Record<string, string> = (a.custom_installment_dates as any) || {};
  const customValues: Record<string, number> = (a.custom_installment_values as any) || {};
  let cumulative = 0;
  const hasEntrada = (a.entrada_value ?? 0) > 0;

  if (hasEntrada) {
    const entradaDate = a.entrada_date || a.first_due_date;
    const entradaAmount = customValues["entrada"] ?? a.entrada_value;
    cumulative += entradaAmount;
    schedule.push({ date: entradaDate, amount: entradaAmount, cumulative });
  }

  for (let i = 0; i < a.new_installments; i++) {
    const instNum = (hasEntrada ? 1 : 0) + i + 1;
    let dueDateStr: string;
    if (customDates[String(instNum)]) {
      dueDateStr = customDates[String(instNum)];
    } else {
      const dueDate = new Date(a.first_due_date + "T12:00:00Z");
      dueDate.setMonth(dueDate.getMonth() + i);
      dueDateStr = dueDate.toISOString().split("T")[0];
    }
    const amount = customValues[String(instNum)] ?? a.new_installment_value;
    cumulative += amount;
    schedule.push({ date: dueDateStr, amount, cumulative });
  }

  schedule.sort((a, b) => a.date.localeCompare(b.date));
  return schedule;
}

function diffDaysFrom(dateStr: string, now: Date): number {
  const dueDate = new Date(`${dateStr}T12:00:00Z`);
  const today = new Date(`${now.toISOString().split("T")[0]}T12:00:00Z`);
  return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
}

function firstUnpaidPastDueDate(a: any, totalPaid: number, todayStr: string): string | null {
  const schedule = buildSchedule(a);
  for (const item of schedule) {
    if (item.date < todayStr && totalPaid < item.cumulative - 0.01) {
      return item.date;
    }
  }
  return null;
}

function shouldExpireAgreement(a: any, totalPaid: number, prazo: number, todayStr: string, now: Date): boolean {
  const firstUnpaidDue = firstUnpaidPastDueDate(a, totalPaid, todayStr);
  if (!firstUnpaidDue) return false;
  return diffDaysFrom(firstUnpaidDue, now) >= Math.max(1, prazo || 10);
}

async function fetchAgreementPaymentTotals(supabase: any, agreementIds: string[]): Promise<Record<string, number>> {
  const eventByAgreement: Record<string, number> = {};
  const directByAgreement: Record<string, number> = {};

  for (let i = 0; i < agreementIds.length; i += 200) {
    const batch = agreementIds.slice(i, i + 200);

    const { data: events } = await supabase
      .from("client_events")
      .select("metadata")
      .in("event_type", ["payment_confirmed", "manual_payment_confirmed"])
      .in("metadata->>agreement_id", batch);
    for (const ev of events || []) {
      const agId = ev.metadata?.agreement_id;
      if (!agId) continue;
      const val = Number(ev.metadata?.valor_pago || ev.metadata?.amount_paid || 0);
      eventByAgreement[agId] = (eventByAgreement[agId] || 0) + val;
    }

    const { data: manualPayments } = await supabase
      .from("manual_payments" as any)
      .select("agreement_id, amount_paid")
      .in("status", ["confirmed", "approved"])
      .in("agreement_id", batch);
    for (const mp of manualPayments || []) {
      const agId = mp.agreement_id;
      if (!agId) continue;
      directByAgreement[agId] = (directByAgreement[agId] || 0) + Number(mp.amount_paid || 0);
    }

    const { data: portalPayments } = await supabase
      .from("portal_payments" as any)
      .select("agreement_id, amount")
      .eq("status", "paid")
      .in("agreement_id", batch);
    for (const pp of portalPayments || []) {
      const agId = pp.agreement_id;
      if (!agId) continue;
      directByAgreement[agId] = (directByAgreement[agId] || 0) + Number(pp.amount || 0);
    }

    const { data: cobrancas } = await supabase
      .from("negociarie_cobrancas" as any)
      .select("agreement_id, valor, valor_pago")
      .eq("status", "pago")
      .in("agreement_id", batch);
    for (const c of cobrancas || []) {
      const agId = c.agreement_id;
      if (!agId) continue;
      directByAgreement[agId] = (directByAgreement[agId] || 0) + Number(c.valor_pago ?? c.valor ?? 0);
    }
  }

  const totals: Record<string, number> = {};
  for (const id of agreementIds) {
    totals[id] = Math.max(eventByAgreement[id] || 0, directByAgreement[id] || 0);
  }
  return totals;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Parse optional payload (on-demand mode)
  let payload: { credor_id?: string; tenant_id?: string } = {};
  if (req.method === "POST") {
    try {
      const text = await req.text();
      if (text) payload = JSON.parse(text);
    } catch {
      // ignore — empty body means cron call
    }
  }

  const onDemand = !!payload.credor_id;
  let triggeredBy: string | null = null;
  let onDemandTenantId: string | null = null;
  let onDemandCredorName: string | null = null;

  // Auth gate for on-demand mode
  if (onDemand) {
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isSystemCall = bearer === serviceKey;

    // Resolve credor → tenant + name
    const { data: credorRow, error: credorErr } = await supabase
      .from("credores")
      .select("id, tenant_id, razao_social, nome_fantasia")
      .eq("id", payload.credor_id!)
      .maybeSingle();
    if (credorErr || !credorRow) {
      return new Response(JSON.stringify({ error: "Credor não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    onDemandTenantId = credorRow.tenant_id;
    onDemandCredorName = credorRow.razao_social || credorRow.nome_fantasia;

    if (!isSystemCall) {
      // Validate user JWT and tenant role
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      triggeredBy = userData.user.id;

      const { data: tu } = await supabase
        .from("tenant_users")
        .select("role")
        .eq("user_id", triggeredBy)
        .eq("tenant_id", onDemandTenantId)
        .maybeSingle();

      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: triggeredBy });
      const allowedRoles = ["admin", "gerente", "supervisor"];
      if (!isSuper && !(tu && allowedRoles.includes((tu as any).role))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  try {
    // ============= ON-DEMAND MODE: only cancel overdue for one credor =============
    if (onDemand) {
      let query = supabase
        .from("agreements")
        .select("id, tenant_id, created_by, client_name, client_cpf, credor, first_due_date, entrada_date, entrada_value, new_installments, new_installment_value, proposed_total, status, custom_installment_dates, custom_installment_values")
        .in("status", ["pending", "approved", "overdue"])
        .eq("tenant_id", onDemandTenantId!);
      // Filter by credor name (agreements.credor stores the name string)
      if (onDemandCredorName) query = query.eq("credor", onDemandCredorName);
      const { data: overdueAgreements, error: errOd } = await query;
      if (errOd) throw errOd;

      const { data: credorPrazo } = await supabase
        .from("credores")
        .select("prazo_dias_acordo")
        .eq("id", payload.credor_id!)
        .maybeSingle();
      const prazo = Math.max(1, Number((credorPrazo as any)?.prazo_dias_acordo || 10));

      let expiredCount = 0;
      let clientsUpdated = 0;
      const errors: string[] = [];

      if (overdueAgreements && overdueAgreements.length > 0) {
        const paymentTotals = await fetchAgreementPaymentTotals(
          supabase,
          overdueAgreements.map((a: any) => a.id)
        );
        const toCancel: any[] = [];
        for (const a of overdueAgreements) {
          if (shouldExpireAgreement(a, paymentTotals[a.id] || 0, prazo, todayStr, now)) {
            toCancel.push(a);
          }
        }

        if (toCancel.length > 0) {
          const ids = toCancel.map((a: any) => a.id);
          const { error: updErr } = await supabase
            .from("agreements")
            .update({ status: "cancelled", cancellation_type: "auto_expired" })
            .in("id", ids);
          if (updErr) errors.push(updErr.message);
          expiredCount = toCancel.length;

          // Cancel pending boletos in negociarie_cobrancas (parity with manual cancel)
          const { data: pendingCobrancas } = await supabase
            .from("negociarie_cobrancas")
            .select("id, id_parcela, agreement_id")
            .in("agreement_id", ids)
            .in("status", ["pendente", "em_aberto"]);

          await supabase
            .from("negociarie_cobrancas")
            .update({ status: "cancelado" } as any)
            .in("agreement_id", ids)
            .in("status", ["pendente", "em_aberto"]);

          // Best-effort cancel at provider
          const cancelables = (pendingCobrancas || []).filter((c: any) => c.id_parcela);
          if (cancelables.length > 0) {
            await Promise.allSettled(
              cancelables.map((c: any) =>
                fetch(`${supabaseUrl}/functions/v1/negociarie-proxy`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({ action: "cancelar-cobranca", id_parcela: String(c.id_parcela) }),
                })
              )
            );
          }

          const { data: quebraStatus } = await supabase
            .from("tipos_status")
            .select("id")
            .eq("nome", "Quebra de Acordo")
            .eq("tenant_id", onDemandTenantId!)
            .maybeSingle();

          const updateData: any = { status: "pendente" };
          if (quebraStatus?.id) updateData.status_cobranca_id = quebraStatus.id;

          const cpfVariants: string[] = [];
          for (const a of toCancel) {
            const rawCpf = (a.client_cpf || "").replace(/[.\-]/g, "");
            const fmtCpf = rawCpf.length === 11
              ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
              : rawCpf;
            cpfVariants.push(rawCpf, fmtCpf, a.client_cpf);
          }
          const uniqueCpfs = [...new Set(cpfVariants)];

          const { count } = await supabase
            .from("clients")
            .update(updateData, { count: "exact" })
            .eq("status", "em_acordo")
            .in("cpf", uniqueCpfs)
            .eq("tenant_id", onDemandTenantId!);
          clientsUpdated = count || 0;

          const notifications = toCancel.map((a: any) => ({
            tenant_id: a.tenant_id,
            user_id: a.created_by,
            title: "Acordo cancelado automaticamente",
            message: `O acordo de ${a.client_name} (${a.client_cpf}) foi cancelado após ${prazo} dias de vencimento.`,
            type: "error",
            reference_type: "agreement",
            reference_id: a.id,
          }));
          await supabase.from("notifications").insert(notifications);
        }
      }

      // Audit log
      if (triggeredBy) {
        await supabase.from("audit_logs").insert({
          tenant_id: onDemandTenantId,
          user_id: triggeredBy,
          action: "auto_expire_agreements_manual",
          entity_type: "credor",
          entity_id: payload.credor_id,
          details: { credor_id: payload.credor_id, expired_count: expiredCount, clients_updated: clientsUpdated, prazo_dias_acordo: prazo },
        });
      }

      return new Response(
        JSON.stringify({ expired_count: expiredCount, clients_updated: clientsUpdated, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= CRON MODE =============
    // 1. Fetch all active agreements
    const { data: activeAgreements, error: err1 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf, credor, first_due_date, entrada_value, entrada_date, new_installments, new_installment_value, proposed_total, status, custom_installment_dates, custom_installment_values")
      .in("status", ["pending", "approved", "overdue"]);

    if (err1) throw err1;

    const toOverdue: any[] = [];
    const toPending: any[] = [];

    if (activeAgreements && activeAgreements.length > 0) {
      const agreementIds = activeAgreements.map(a => a.id);
      const paymentByAgreement = await fetchAgreementPaymentTotals(supabase, agreementIds);

      const toApproved: any[] = [];

      for (const a of activeAgreements) {
        const totalPaid = paymentByAgreement[a.id] || 0;

        // Check if fully paid
        if (totalPaid >= (a.proposed_total || 0) - 0.01 && a.proposed_total > 0) {
          toApproved.push(a);
          continue;
        }

        const schedule = buildSchedule(a);
        const pastDueEntries = schedule.filter(s => s.date < todayStr);

        if (pastDueEntries.length === 0) {
          if (a.status === "overdue") toPending.push(a);
          continue;
        }

        const expectedPaid = pastDueEntries[pastDueEntries.length - 1].cumulative;
        const isOverdue = totalPaid < expectedPaid - 0.01;

        if (isOverdue && a.status !== "overdue") {
          toOverdue.push(a);
        } else if (!isOverdue && a.status === "overdue") {
          toPending.push(a);
        }
      }

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

      if (toPending.length > 0) {
        const ids = toPending.map((a: any) => a.id);
        await supabase.from("agreements").update({ status: "pending" }).in("id", ids);
      }

      if (toApproved.length > 0) {
        const ids = toApproved.map((a: any) => a.id);
        await supabase.from("agreements").update({ status: "approved" }).in("id", ids);

        // Update client status to 'pago' for fully paid agreements
        for (const a of toApproved) {
          const rawCpf = (a.client_cpf || "").replace(/[.\-]/g, "");
          const fmtCpf = rawCpf.length === 11
            ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
            : rawCpf;
          await supabase
            .from("clients")
            .update({ status: "pago" })
            .eq("status", "em_acordo")
            .in("cpf", [rawCpf, fmtCpf, a.client_cpf])
            .eq("tenant_id", a.tenant_id);
        }
      }
    }

    // 2. Cancel overdue agreements based on credor's prazo_dias_acordo
    const { data: overdueAgreements, error: err2 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf, credor, first_due_date, entrada_date, entrada_value, new_installments, new_installment_value, proposed_total, status, custom_installment_dates, custom_installment_values")
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

      const paymentTotals = await fetchAgreementPaymentTotals(
        supabase,
        overdueAgreements.map((a: any) => a.id)
      );

      const toCancel: any[] = [];
      for (const a of overdueAgreements) {
        const prazo = Math.max(1, Number(prazoMap[`${a.tenant_id}|${a.credor}`] || 10));
        if (shouldExpireAgreement(a, paymentTotals[a.id] || 0, prazo, todayStr, now)) {
          toCancel.push(a);
        }
      }

      if (toCancel.length > 0) {
        const ids = toCancel.map((a: any) => a.id);
        await supabase.from("agreements").update({ status: "cancelled", cancellation_type: "auto_expired" }).in("id", ids);

        // Cancel pending boletos in negociarie_cobrancas (parity with manual cancel)
        const { data: pendingCobrancas } = await supabase
          .from("negociarie_cobrancas")
          .select("id, id_parcela, agreement_id")
          .in("agreement_id", ids)
          .in("status", ["pendente", "em_aberto"]);

        await supabase
          .from("negociarie_cobrancas")
          .update({ status: "cancelado" } as any)
          .in("agreement_id", ids)
          .in("status", ["pendente", "em_aberto"]);

        const cancelables = (pendingCobrancas || []).filter((c: any) => c.id_parcela);
        if (cancelables.length > 0) {
          await Promise.allSettled(
            cancelables.map((c: any) =>
              fetch(`${supabaseUrl}/functions/v1/negociarie-proxy`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ action: "cancelar-cobranca", id_parcela: String(c.id_parcela) }),
              })
            )
          );
        }

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

        // Batch client updates by tenant to reduce queries
        const cancelByTenant: Record<string, any[]> = {};
        for (const a of toCancel) {
          if (!cancelByTenant[a.tenant_id]) cancelByTenant[a.tenant_id] = [];
          cancelByTenant[a.tenant_id].push(a);
        }

        for (const [tenantId, agreements] of Object.entries(cancelByTenant)) {
          const quebraId = quebraStatusByTenant[tenantId];
          const updateData: any = { status: "pendente" };
          if (quebraId) updateData.status_cobranca_id = quebraId;

          const cpfVariants: string[] = [];
          for (const a of agreements) {
            const rawCpf = (a.client_cpf || "").replace(/[.\-]/g, "");
            const fmtCpf = rawCpf.length === 11
              ? `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`
              : rawCpf;
            cpfVariants.push(rawCpf, fmtCpf, a.client_cpf);
          }
          const uniqueCpfs = [...new Set(cpfVariants)];

          await supabase
            .from("clients")
            .update(updateData)
            .eq("status", "em_acordo")
            .in("cpf", uniqueCpfs)
            .eq("tenant_id", tenantId);
        }

        const notifications = toCancel.map((a: any) => {
          const p = Math.max(1, Number(prazoMap[`${a.tenant_id}|${a.credor}`] || 10));
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

    // 3. Mark overdue client installments via RPC (server-side batching)
    const { data: updatedTotal, error: err3 } = await supabase.rpc("mark_overdue_clients", {
      p_today: todayStr,
      p_batch_size: 1000,
    });
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
