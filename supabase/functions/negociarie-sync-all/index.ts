// Cron-triggered scan to sync paid installments from Negociarie across all
// active tenants and direct-billing creditors. Calls negociarie-sync-payments
// internally (per scope) with a short window (3 days) since this runs 2x/day.
//
// Auth: header `x-cron-secret` must match CRON_SECRET env.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const NEGOCIARIE_BASE = "https://sistema.negociarie.com.br/api/v2";
const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";

async function resolveCreds(admin: any, tenantId: string, creditorId: string | null) {
  if (creditorId) {
    const { data: ci } = await admin
      .from("tenant_integrations")
      .select("config")
      .eq("tenant_id", tenantId)
      .eq("creditor_id", creditorId)
      .eq("provider", "negociarie")
      .eq("is_active", true)
      .maybeSingle();
    const cfg = (ci?.config as Record<string, any>) || {};
    if (cfg.client_id && cfg.client_secret) {
      return { clientId: cfg.client_id as string, clientSecret: cfg.client_secret as string };
    }
    return null; // direct creditor without creds — skip
  }
  const { data: ti } = await admin
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", tenantId)
    .is("creditor_id", null)
    .eq("provider", "negociarie")
    .eq("is_active", true)
    .maybeSingle();
  const cfg = (ti?.config as Record<string, any>) || {};
  const useGlobal = cfg.uses_global_fallback === true;
  const clientId = (!useGlobal && cfg.client_id) || Deno.env.get("NEGOCIARIE_CLIENT_ID");
  const clientSecret = (!useGlobal && cfg.client_secret) || Deno.env.get("NEGOCIARIE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function login(creds: { clientId: string; clientSecret: string }) {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  const j = await res.json();
  const t = j.access_token || j.token;
  if (!t) throw new Error("no token");
  return t;
}

async function fetchParcelasPagas(token: string, dateIso: string): Promise<any[]> {
  const res = await fetch(`${NEGOCIARIE_BASE}/cobranca/parcelas-pagas?data=${dateIso}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text();
  if (!res.ok) return [];
  try {
    const j = JSON.parse(txt);
    if (Array.isArray(j)) return j;
    if (Array.isArray(j?.parcelas)) return j.parcelas;
    if (Array.isArray(j?.data)) return j.data;
  } catch { /* ignore */ }
  return [];
}

function* lastDays(days: number): Generator<string> {
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    yield d.toISOString().split("T")[0];
  }
}

async function postToCallback(supabaseUrl: string, parcelas: any[]) {
  if (parcelas.length === 0) return 0;
  const res = await fetch(`${supabaseUrl}/functions/v1/negociarie-callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parcelas }),
  });
  const txt = await res.text();
  try {
    const j = JSON.parse(txt);
    return Number(j?.processed || 0);
  } catch { return 0; }
}

async function runScope(admin: any, supabaseUrl: string, tenantId: string, creditorId: string | null, days: number) {
  const creds = await resolveCreds(admin, tenantId, creditorId);
  if (!creds) return { scanned: 0, matched: 0, processed: 0, skipped: true };

  let token: string;
  try { token = await login(creds); }
  catch { return { scanned: 0, matched: 0, processed: 0, error: "login_failed" }; }

  let scanned = 0, matched = 0, processed = 0;
  for (const date of lastDays(days)) {
    const parcelas = await fetchParcelasPagas(token, date);
    if (parcelas.length === 0) continue;
    scanned += parcelas.length;

    const ids = parcelas.map(p => String(p.id_parcela || p.idParcela || "")).filter(Boolean);
    if (ids.length === 0) continue;

    const { data: local } = await admin
      .from("negociarie_cobrancas")
      .select("id_parcela")
      .eq("tenant_id", tenantId)
      .in("id_parcela", ids);
    const localIds = new Set((local || []).map((r: any) => r.id_parcela));
    const filtered = parcelas.filter(p => localIds.has(String(p.id_parcela || p.idParcela || "")));
    if (filtered.length === 0) continue;
    matched += filtered.length;

    const normalized = filtered.map(p => ({
      id_parcela: String(p.id_parcela || p.idParcela),
      id_status: 801,
      status: "PAGO",
      valor_pago: Number(p.valor_pago ?? p.valorPago ?? p.valor ?? 0),
      valor: Number(p.valor ?? 0),
      data_pagamento: p.data_pagamento || p.dataPagamento || date,
    }));
    processed += await postToCallback(supabaseUrl, normalized);
  }
  return { scanned, matched, processed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  const got = req.headers.get("x-cron-secret");
  if (!expected || got !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = await req.json().catch(() => ({}));
  const days = Math.min(Math.max(Number(body.days || 3), 1), 14);

  const { data: tenants } = await admin
    .from("tenants")
    .select("id")
    .eq("status", "active");

  const results: any[] = [];
  let totalProcessed = 0;

  for (const t of (tenants || [])) {
    const tenantId = t.id;

    // 1) Master account scope
    try {
      const r = await runScope(admin, supabaseUrl, tenantId, null, days);
      results.push({ tenant_id: tenantId, scope: "master", ...r });
      totalProcessed += r.processed;
    } catch (e) {
      results.push({ tenant_id: tenantId, scope: "master", error: (e as Error).message });
    }

    // 2) Direct-billing creditors
    const { data: directs } = await admin
      .from("credores")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("cobrança_direta_ativa", true);

    for (const c of (directs || [])) {
      try {
        const r = await runScope(admin, supabaseUrl, tenantId, c.id, days);
        results.push({ tenant_id: tenantId, scope: "creditor", creditor_id: c.id, ...r });
        totalProcessed += r.processed;
      } catch (e) {
        results.push({ tenant_id: tenantId, scope: "creditor", creditor_id: c.id, error: (e as Error).message });
      }
    }
  }

  // Audit
  try {
    await admin.from("audit_logs").insert({
      action: "negociarie_cron_sync",
      entity: "negociarie",
      metadata: { days, total_processed: totalProcessed, scopes: results.length, results: results.slice(0, 100) },
    });
  } catch { /* non-blocking */ }

  return new Response(JSON.stringify({
    ok: true,
    ran_at: new Date().toISOString(),
    days,
    total_processed: totalProcessed,
    scopes: results.length,
    results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
