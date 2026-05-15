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

  const emDiaId = resolveId("em_dia", "Em Dia");
  const inadimplenteId = resolveId("inadimplente", "Inadimplente");
  const acordoVigenteId = resolveId("acordo_vigente", "Acordo Vigente");
  const acordoAtrasadoId = resolveId("acordo_atrasado", "Acordo em Atraso");
  const quebraAcordoId = resolveId("acordo_cancelado", "Acordo Cancelado");
  const quitadoId = resolveId("quitado", "Quitado");
  const acordoQuitadoId = resolveId("acordo_quitado", "Acordo Quitado");

  if (!emDiaId || !inadimplenteId) {
    return {
      tenant_id,
      skipped: true,
      reason: "Status 'Em dia' ou 'Inadimplente' não encontrados",
    };
  }

  // 2. Fetch ALL active agreements (small dataset, paginated for safety)
  const PAGE = 1000;
  const allAgreements: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("agreements")
      .select("id, client_cpf, credor, status, created_at, updated_at")
      .eq("tenant_id", tenant_id)
      .neq("status", "rejected")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allAgreements.push(...data);
    if (data.length < PAGE) break;
  }

  // 3. Index agreements by normalized CPF+Credor
  const agreementsByKey = new Map<string, any[]>();
  allAgreements.forEach((a: any) => {
    const rawCpf = (a.client_cpf || "").replace(/\D/g, "");
    const key = `${rawCpf}|${a.credor}`;
    if (!agreementsByKey.has(key)) agreementsByKey.set(key, []);
    agreementsByKey.get(key)!.push(a);
  });

  // 4. Stream clients page by page, ordered by (cpf, credor) so groups are contiguous.
  //    Carry-over the last partial group between pages.
  let countQuitado = 0, countAcordoVigente = 0, countAcordoAtrasado = 0;
  let countQuebraAcordo = 0, countInadimplente = 0, countEmDia = 0;
  let totalUpdated = 0;

  const pendingUpdates = new Map<string, string[]>(); // statusId -> client ids
  const flushUpdates = async () => {
    for (const [statusId, ids] of pendingUpdates) {
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        await supabase
          .from("clients")
          .update({ status_cobranca_id: statusId })
          .eq("tenant_id", tenant_id)
          .in("id", batch);
        totalUpdated += batch.length;
      }
    }
    pendingUpdates.clear();
  };

  // SSOT: delega para get_client_consolidated_status (RPC canônica do banco).
  // Não duplica regras aqui — apenas persiste em clients.status_cobranca_id.
  const processGroup = async (clients: any[]) => {
    if (clients.length === 0) return;
    const cpf = clients[0].cpf;
    const credor = clients[0].credor;

    const { data: canonical, error: errCanon } = await supabase.rpc(
      "get_client_consolidated_status",
      { _tenant_id: tenant_id, _cpf: cpf, _credor: credor, _atraso_quebra_dias: null }
    );
    if (errCanon || !canonical) return;

    const { data: legacy, error: errLegacy } = await supabase.rpc(
      "map_canonical_to_legacy_status",
      { _canonical: canonical }
    );
    if (errLegacy || !legacy) return;

    const targetStatusId = statusByName.get(legacy);
    if (!targetStatusId) return;

    // Contagens por papel canônico
    switch (canonical) {
      case "quitado": countQuitado += clients.length; break;
      case "acordo_vigente": countAcordoVigente += clients.length; break;
      case "acordo_atrasado": countAcordoAtrasado += clients.length; break;
      case "acordo_cancelado": countQuebraAcordo += clients.length; break;
      case "acordo_quitado": (counts.acordo_quitado = (counts.acordo_quitado || 0) + clients.length); break;
      case "inadimplente": countInadimplente += clients.length; break;
      case "em_dia": countEmDia += clients.length; break;
    }

    for (const c of clients) {
      if (c.status_cobranca_id !== targetStatusId) {
        if (!pendingUpdates.has(targetStatusId)) pendingUpdates.set(targetStatusId, []);
        pendingUpdates.get(targetStatusId)!.push(c.id);
      }
    }
  };

  let carry: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, cpf, credor, status, data_vencimento, status_cobranca_id")
      .eq("tenant_id", tenant_id)
      .order("cpf", { ascending: true })
      .order("credor", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    let cur: any[] = carry;
    const normCpf = (s: any) => (s || "").toString().replace(/\D/g, "");
    for (const c of data) {
      if (
        cur.length === 0 ||
        (normCpf(cur[0].cpf) === normCpf(c.cpf) && cur[0].credor === c.credor)
      ) {
        cur.push(c);
      } else {
        processGroup(cur);
        cur = [c];
      }
    }
    if (data.length < PAGE) {
      // Last page — process the final group too
      processGroup(cur);
      carry = [];
      break;
    } else {
      // Hold the trailing group as carry (it may continue on next page)
      carry = cur;
    }

    // Periodically flush updates to avoid building up memory
    if (pendingUpdates.size > 50) {
      await flushUpdates();
    }
  }
  // Final flush
  await flushUpdates();

  // 5. Bloco de expiração de Negociação removido (agora é apenas Tabulação/Manual)

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

    // SINGLE-TENANT MODE: requires authorization
    if (tenant_id) {
      const authHeader = req.headers.get("Authorization") || "";
      const apikeyHeader = req.headers.get("apikey") || "";
      const isServiceRole =
        authHeader === `Bearer ${serviceRoleKey}` || apikeyHeader === serviceRoleKey;

      let authorized = isServiceRole;

      if (!authorized && authHeader.startsWith("Bearer ")) {
        const jwt = authHeader.replace("Bearer ", "");
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        const { data: userData } = await userClient.auth.getUser();
        const user = userData?.user;
        if (user) {
          // Super admin global
          const { data: isAdmin } = await supabase.rpc("has_role", {
            _user_id: user.id,
            _role: "admin",
          });
          if (isAdmin) authorized = true;
          if (!authorized) {
            const { data: tu } = await supabase
              .from("tenant_users")
              .select("role")
              .eq("user_id", user.id)
              .eq("tenant_id", tenant_id)
              .in("role", ["admin", "gerente", "supervisor"])
              .maybeSingle();
            if (tu) authorized = true;
          }
        }
      }

      if (!authorized) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await syncTenant(supabase, tenant_id);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CRON / MULTI-TENANT MODE: only active tenants
    const { data: tenants, error: tenantsErr } = await supabase
      .from("tenants")
      .select("id, name, status")
      .eq("status", "active");

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
