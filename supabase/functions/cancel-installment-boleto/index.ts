// Cancels a single Negociarie boleto for an agreement installment.
// Reuses the same credential resolution + DELETE pattern as cancel-agreement-boletos.
//
// Body: { cobranca_id: uuid, tenant_id: uuid, reason?: string }
// Auth: header `x-cron-secret` OR Supabase service_role bearer.

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
      .eq("tenant_id", tenantId).eq("creditor_id", creditorId)
      .eq("provider", "negociarie").eq("is_active", true).maybeSingle();
    const cfg = (ci?.config as Record<string, any>) || {};
    if (cfg.client_id && cfg.client_secret) {
      return { clientId: cfg.client_id as string, clientSecret: cfg.client_secret as string };
    }
  }
  const { data: ti } = await admin
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", tenantId).is("creditor_id", null)
    .eq("provider", "negociarie").eq("is_active", true).maybeSingle();
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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`login failed ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  return j.access_token || j.token;
}

async function cancelInNegociarie(token: string, idParcela: string) {
  const res = await fetch(`${NEGOCIARIE_BASE}/cobranca/${encodeURIComponent(idParcela)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text();
  if (res.ok) return { ok: true as const };
  if (res.status === 404) return { ok: true as const, reason: "not_found" };
  return { ok: false as const, status: res.status, body: txt.slice(0, 200) };
}

function authorize(req: Request): boolean {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === Deno.env.get("CRON_SECRET")) return true;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const tok = auth.replace("Bearer ", "");
    if (tok === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!authorize(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const cobrancaId: string | undefined = body.cobranca_id;
    const tenantId: string | undefined = body.tenant_id;
    const reason: string | null = body.reason || null;

    if (!cobrancaId || !tenantId) {
      return new Response(JSON.stringify({ error: "cobranca_id and tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: cob, error: cobErr } = await admin
      .from("negociarie_cobrancas")
      .select("id, tenant_id, agreement_id, id_parcela, status, installment_key, credor_id")
      .eq("id", cobrancaId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (cobErr || !cob) {
      return new Response(JSON.stringify({ error: "cobranca not found", gateway: "negociarie" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = String(cob.status || "").toUpperCase();
    if (status === "PAGO") {
      return new Response(JSON.stringify({ ok: false, gateway: "negociarie", skipped_reason: "already_paid" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status === "CANCELADO" || status === "CANCELLED") {
      // Already cancelled — idempotent success
      return new Response(JSON.stringify({ ok: true, gateway: "negociarie", skipped_reason: "already_cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await resolveCreds(admin, tenantId, (cob as any).credor_id || null);
    if (!creds) {
      return new Response(JSON.stringify({ error: "negociarie credentials not found", gateway: "negociarie" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await login(creds);
    const r = await cancelInNegociarie(token, String(cob.id_parcela));

    if (!r.ok) {
      return new Response(JSON.stringify({
        ok: false, gateway: "negociarie", status: r.status, body: r.body,
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("negociarie_cobrancas")
      .update({ status: "CANCELADO", id_status: 999, updated_at: new Date().toISOString() })
      .eq("id", cob.id);

    try {
      await admin.from("audit_logs").insert({
        tenant_id: tenantId,
        action: "cancel_installment_boleto",
        entity: "negociarie_cobranca",
        entity_id: cob.id,
        metadata: {
          agreement_id: cob.agreement_id,
          installment_key: cob.installment_key,
          id_parcela: cob.id_parcela,
          reason,
          idempotent_404: r.reason === "not_found",
        },
      });
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({
      ok: true, gateway: "negociarie", cobranca_id: cob.id,
      idempotent_404: r.reason === "not_found",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
