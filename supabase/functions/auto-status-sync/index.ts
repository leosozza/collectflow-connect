import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function syncTenant(supabase: any, tenant_id: string) {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const counts: Record<string, number> = {};

  // 1. Get status IDs for this tenant
  const { data: statusList } = await supabase
    .from("tipos_status")
    .select("id, nome, regras")
    .eq("tenant_id", tenant_id);

  const statusByName = new Map<string, string>();
  const statusByPapel = new Map<string, string>();
  const regrasByPapel = new Map<string, any>();
  const regrasByName = new Map<string, any>();
  (statusList || []).forEach((s: any) => {
    statusByName.set(s.nome, s.id);
    regrasByName.set(s.nome, s.regras || {});
    const papel = s.regras?.papel_sistema;
    if (papel) {
      statusByPapel.set(papel, s.id);
      regrasByPapel.set(papel, s.regras || {});
    }
  });

  const resolveId = (papel: string, fallbackNome: string) =>
    statusByPapel.get(papel) || statusByName.get(fallbackNome);

  const emDiaId = resolveId("em_dia", "Em dia");
  const inadimplenteId = resolveId("inadimplente", "Inadimplente");
  const acordoVigenteId = resolveId("acordo_vigente", "Acordo Vigente");
  const acordoAtrasadoId = resolveId("acordo_atrasado", "Acordo Atrasado");
  const quebraAcordoId = resolveId("quebra_acordo", "Quebra de Acordo");
  const quitadoId = resolveId("quitado", "Quitado");
  const emNegociacaoId = resolveId("em_negociacao", "Em negociação");

  if (!emDiaId || !inadimplenteId) {
    return {
      tenant_id,
      skipped: true,
      reason: "Status 'Em dia' ou 'Inadimplente' não encontrados",
    };
  }

  // 2. Fetch ALL clients
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, cpf, credor, status, data_vencimento, status_cobranca_id")
    .eq("tenant_id", tenant_id);

  // 3. Fetch ALL active agreements
  const { data: allAgreements } = await supabase
    .from("agreements")
    .select("id, client_cpf, credor, status")
    .eq("tenant_id", tenant_id)
    .not("status", "in", "(rejected)");

  // 4. Group clients by CPF+Credor
  const cpfGroups = new Map<string, any[]>();
  (allClients || []).forEach((c: any) => {
    const key = `${c.cpf}|${c.credor}`;
    if (!cpfGroups.has(key)) cpfGroups.set(key, []);
    cpfGroups.get(key)!.push(c);
  });

  // 5. Index agreements
  const agreementsByKey = new Map<string, any[]>();
  (allAgreements || []).forEach((a: any) => {
    const rawCpf = (a.client_cpf || "").replace(/\D/g, "");
    const key = `${rawCpf}|${a.credor}`;
    if (!agreementsByKey.has(key)) agreementsByKey.set(key, []);
    agreementsByKey.get(key)!.push(a);
  });

  // 6. Apply hierarchy
  const updates: { ids: string[]; statusId: string }[] = [];
  let countQuitado = 0, countAcordoVigente = 0, countAcordoAtrasado = 0;
  let countQuebraAcordo = 0, countInadimplente = 0, countEmDia = 0;

  cpfGroups.forEach((clients) => {
    const rawCpf = clients[0].cpf.replace(/\D/g, "");
    const agreementKey = `${rawCpf}|${clients[0].credor}`;
    const agreements = agreementsByKey.get(agreementKey) || [];

    const allInNegociacao = clients.every((c: any) => c.status_cobranca_id === emNegociacaoId);
    if (allInNegociacao && emNegociacaoId) return;

    let targetStatusId: string | null = null;

    const allPago = clients.every((c: any) => c.status === "pago");
    const allAgreementsApproved = agreements.length > 0 && agreements.every((a: any) => a.status === "approved" || a.status === "cancelled");
    if (allPago && quitadoId) {
      targetStatusId = quitadoId;
      countQuitado += clients.length;
    }

    if (!targetStatusId && acordoVigenteId) {
      const hasPending = agreements.some((a: any) => a.status === "pending");
      if (hasPending) {
        targetStatusId = acordoVigenteId;
        countAcordoVigente += clients.length;
      }
    }

    if (!targetStatusId && acordoAtrasadoId) {
      const hasOverdue = agreements.some((a: any) => a.status === "overdue");
      if (hasOverdue) {
        targetStatusId = acordoAtrasadoId;
        countAcordoAtrasado += clients.length;
      }
    }

    if (!targetStatusId && quebraAcordoId) {
      const sortedAgreements = [...agreements].sort((a, b) =>
        (b.id > a.id ? 1 : -1)
      );
      if (sortedAgreements.length > 0 && sortedAgreements[0].status === "cancelled") {
        targetStatusId = quebraAcordoId;
        countQuebraAcordo += clients.length;
      }
    }

    if (!targetStatusId) {
      const hasOverdue = clients.some((c: any) =>
        c.data_vencimento < today && (c.status === "pendente" || c.status === "vencido")
      );
      const hasActiveAgreement = agreements.some((a: any) =>
        a.status === "pending" || a.status === "overdue"
      );
      if (hasOverdue && !hasActiveAgreement) {
        targetStatusId = inadimplenteId;
        countInadimplente += clients.length;
      }
    }

    if (!targetStatusId) {
      targetStatusId = emDiaId;
      countEmDia += clients.length;
    }

    const idsToUpdate = clients
      .filter((c: any) => c.status_cobranca_id !== targetStatusId)
      .map((c: any) => c.id);

    if (idsToUpdate.length > 0 && targetStatusId) {
      updates.push({ ids: idsToUpdate, statusId: targetStatusId });
    }
  });

  // 7. Apply updates in batches
  let totalUpdated = 0;
  for (const { ids, statusId } of updates) {
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      await supabase
        .from("clients")
        .update({ status_cobranca_id: statusId })
        .eq("tenant_id", tenant_id)
        .in("id", batch);
      totalUpdated += batch.length;
    }
  }

  // 8. Expire "Em negociação"
  if (emNegociacaoId) {
    const regras = regrasByPapel.get("em_negociacao") || regrasByName.get("Em negociação") || {};
    const expiracaoDias = regras.tempo_expiracao_dias || 10;
    const autoTransicaoNome = regras.auto_transicao || "Inadimplente";
    const targetId = statusByName.get(autoTransicaoNome) || inadimplenteId;

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
          .eq("tenant_id", tenant_id)
          .in("id", batch);
      }
    }
    counts.negociacao_expirada = idsToExpire.length;
  }

  counts.total_updated = totalUpdated;
  counts.quitado = countQuitado;
  counts.acordo_vigente = countAcordoVigente;
  counts.acordo_atrasado = countAcordoAtrasado;
  counts.quebra_acordo = countQuebraAcordo;
  counts.inadimplente = countInadimplente;
  counts.em_dia = countEmDia;

  return { tenant_id, ...counts };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let tenant_id: string | null = null;
    try {
      const body = await req.json();
      tenant_id = body?.tenant_id || null;
    } catch {
      // No body or invalid JSON
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // SINGLE-TENANT MODE
    if (tenant_id) {
      const result = await syncTenant(supabase, tenant_id);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRON / MULTI-TENANT MODE: iterate over all tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from("tenants")
      .select("id, name, status")
      .neq("status", "inactive");

    if (tenantsErr) {
      return new Response(
        JSON.stringify({ error: tenantsErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    let totalUpdatedAll = 0;
    for (const t of tenants || []) {
      try {
        const r = await syncTenant(supabase, t.id);
        results.push(r);
        totalUpdatedAll += Number(r.total_updated || 0);
      } catch (e: any) {
        results.push({ tenant_id: t.id, error: e?.message || String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: "cron",
        tenants_processed: results.length,
        total_updated: totalUpdatedAll,
        results,
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
