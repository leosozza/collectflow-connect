// Sync paid installments from Negociarie account directly into RIVO.
// Used when the Negociarie webhook didn't fire (e.g. callback URL not registered yet).
// Resolves credentials per credor (cobrança direta) or per tenant.
//
// Body: { tenant_id?: string, creditor_id?: string, days?: number }
//   - tenant_id: optional (defaults to authenticated user's tenant)
//   - creditor_id: optional (when provided + credor has cobrança_direta_ativa, uses credor's account)
//   - days: how many days back to scan (default 14, max 60)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEGOCIARIE_BASE = "https://sistema.negociarie.com.br/api/v2";
const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";

async function resolveCreds(admin: any, tenantId: string, creditorId?: string) {
  if (creditorId) {
    const { data: cr } = await admin
      .from("credores")
      .select("cobrança_direta_ativa")
      .eq("id", creditorId)
      .maybeSingle();
    if (cr?.cobrança_direta_ativa) {
      const { data: ci } = await admin
        .from("tenant_integrations")
        .select("config")
        .eq("tenant_id", tenantId)
        .eq("creditor_id", creditorId)
        .eq("provider", "negociarie")
        .eq("is_active", true)
        .maybeSingle();
      const cfg = (ci?.config as Record<string, any>) || {};
      if (cfg.client_id && cfg.client_secret) return { clientId: cfg.client_id, clientSecret: cfg.client_secret };
      throw new Error("Credenciais Negociarie do credor não cadastradas");
    }
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
  if (!clientId || !clientSecret) throw new Error("Credenciais Negociarie não configuradas");
  return { clientId, clientSecret };
}

async function login(creds: { clientId: string; clientSecret: string }) {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret }),
  });
  if (!res.ok) throw new Error(`Falha ao autenticar Negociarie: ${res.status}`);
  const j = await res.json();
  const t = j.access_token || j.token;
  if (!t) throw new Error("Token não retornado");
  return t;
}

async function fetchParcelasPagas(token: string, dateIso: string): Promise<any[]> {
  const res = await fetch(`${NEGOCIARIE_BASE}/cobranca/parcelas-pagas?data=${dateIso}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text();
  if (!res.ok) {
    console.warn(`[sync-payments] parcelas-pagas ${dateIso} status=${res.status} body=${txt.slice(0, 200)}`);
    return [];
  }
  let json: any;
  try { json = JSON.parse(txt); } catch { return []; }
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.parcelas)) return json.parcelas;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

function* dateRangeBack(days: number): Generator<string> {
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    yield d.toISOString().split("T")[0];
  }
}

async function applyBaixaToCallback(supabaseUrl: string, parcelas: any[]) {
  if (parcelas.length === 0) return { ok: true, processed: 0 };
  const res = await fetch(`${supabaseUrl}/functions/v1/negociarie-callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parcelas }),
  });
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { ok: res.ok, raw: txt }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const tok = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(tok);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub;

    const body = await req.json().catch(() => ({}));
    const requestedDays = Math.min(Math.max(Number(body.days || 14), 1), 60);
    const creditorId: string | undefined = body.creditor_id || undefined;

    let tenantId: string | null = body.tenant_id || null;
    if (!tenantId) {
      const { data: tu } = await admin.from("tenant_users").select("tenant_id").eq("user_id", userId).maybeSingle();
      tenantId = tu?.tenant_id || null;
    }
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant não identificado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await resolveCreds(admin, tenantId, creditorId);
    const token = await login(creds);

    // Filtra parcelas que existem no nosso DB para evitar enviar lixo ao callback
    let totalScanned = 0;
    let totalMatched = 0;
    let totalBaixadas = 0;
    const errors: string[] = [];

    for (const date of dateRangeBack(requestedDays)) {
      let parcelas: any[] = [];
      try { parcelas = await fetchParcelasPagas(token, date); }
      catch (e) { errors.push(`${date}: ${(e as Error).message}`); continue; }
      if (parcelas.length === 0) continue;
      totalScanned += parcelas.length;

      // Match local cobrancas (escopo do tenant; e do credor se aplicável)
      const ids = parcelas.map(p => String(p.id_parcela || p.idParcela || "")).filter(Boolean);
      if (ids.length === 0) continue;

      let q = admin
        .from("negociarie_cobrancas")
        .select("id_parcela, agreement_id, tenant_id, status")
        .eq("tenant_id", tenantId)
        .in("id_parcela", ids);
      const { data: localCobrs } = await q;
      const localIds = new Set((localCobrs || []).map(r => r.id_parcela));
      const matched = parcelas.filter(p => localIds.has(String(p.id_parcela || p.idParcela || "")));
      if (matched.length === 0) continue;
      totalMatched += matched.length;

      // Normaliza payload e envia para o callback (mesma rotina de baixa)
      const normalized = matched.map(p => ({
        id_parcela: String(p.id_parcela || p.idParcela),
        id_status: 801,
        status: "PAGO",
        valor_pago: Number(p.valor_pago ?? p.valorPago ?? p.valor ?? 0),
        valor: Number(p.valor ?? 0),
        data_pagamento: p.data_pagamento || p.dataPagamento || date,
      }));

      const r = await applyBaixaToCallback(supabaseUrl, normalized);
      const proc = Number(r?.processed || 0);
      totalBaixadas += proc;
    }

    return new Response(JSON.stringify({
      ok: true,
      tenant_id: tenantId,
      creditor_id: creditorId || null,
      days: requestedDays,
      scanned: totalScanned,
      matched: totalMatched,
      processed: totalBaixadas,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[sync-payments] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
