// Cancels active Negociarie boletos for an agreement when it's broken/cancelled,
// respecting credores.prazo_dias_acordo (don't cancel installments still inside
// the grace window — those remain so the customer can still pay; status flagged).
//
// Body: { agreement_id: uuid, tenant_id?: uuid, force?: boolean }
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
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  const j = await res.json();
  return j.access_token || j.token;
}

async function cancelInNegociarie(token: string, idParcela: string) {
  const res = await fetch(`${NEGOCIARIE_BASE}/cobranca/${encodeURIComponent(idParcela)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text();
  if (res.ok) return { ok: true };
  if (res.status === 404) return { ok: true, reason: "not_found" }; // idempotent
  return { ok: false, status: res.status, body: txt.slice(0, 200) };
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
    const agreementId: string | undefined = body.agreement_id;
    const force: boolean = body.force === true;
    if (!agreementId) {
      return new Response(JSON.stringify({ error: "agreement_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: agreement, error: agrErr } = await admin
      .from("agreements")
      .select("id, tenant_id, credor, status")
      .eq("id", agreementId).maybeSingle();
    if (agrErr || !agreement) {
      return new Response(JSON.stringify({ error: "agreement not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = agreement.tenant_id;

    // Resolve credor (by name) → check cobrança_direta_ativa + prazo_dias_acordo
    let creditorId: string | null = null;
    let prazoDias = 0;
    if (agreement.credor) {
      const { data: cred } = await admin
        .from("credores")
        .select("id, cobrança_direta_ativa, prazo_dias_acordo")
        .eq("tenant_id", tenantId)
        .or(`razao_social.ilike.${agreement.credor},nome_fantasia.ilike.${agreement.credor}`)
        .maybeSingle();
      if (cred?.cobrança_direta_ativa) creditorId = cred.id;
      prazoDias = Number(cred?.prazo_dias_acordo || 0);
    }

    const creds = await resolveCreds(admin, tenantId, creditorId);
    if (!creds) {
      return new Response(JSON.stringify({ error: "negociarie credentials not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active (unpaid, non-cancelled) boletos for this agreement
    const { data: cobrs } = await admin
      .from("negociarie_cobrancas")
      .select("id, id_parcela, status, data_vencimento, installment_key")
      .eq("tenant_id", tenantId)
      .eq("agreement_id", agreementId);

    const today = new Date();
    const cancelled: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    const token = await login(creds);

    for (const c of (cobrs || [])) {
      const status = String(c.status || "").toUpperCase();
      if (status === "PAGO" || status === "CANCELADO" || status === "CANCELLED") {
        skipped.push({ id_parcela: c.id_parcela, reason: "already_" + status.toLowerCase() });
        continue;
      }

      // Respect grace window: if due_date + prazo_dias_acordo is still in the future, don't cancel
      if (!force && prazoDias > 0 && c.data_vencimento) {
        const dv = new Date(c.data_vencimento + "T00:00:00");
        const graceEnd = new Date(dv); graceEnd.setDate(dv.getDate() + prazoDias);
        if (graceEnd > today) {
          skipped.push({ id_parcela: c.id_parcela, reason: "within_grace", grace_until: graceEnd.toISOString().split("T")[0] });
          continue;
        }
      }

      const r = await cancelInNegociarie(token, String(c.id_parcela));
      if (r.ok) {
        await admin.from("negociarie_cobrancas")
          .update({ status: "CANCELADO", id_status: 999, updated_at: new Date().toISOString() })
          .eq("id", c.id);
        cancelled.push({ id_parcela: c.id_parcela, reason: r.reason || "cancelled" });
      } else {
        errors.push({ id_parcela: c.id_parcela, ...r });
      }
    }

    try {
      await admin.from("audit_logs").insert({
        tenant_id: tenantId,
        action: "cancel_agreement_boletos",
        entity: "agreement",
        entity_id: agreementId,
        metadata: {
          agreement_status: agreement.status, prazo_dias_acordo: prazoDias,
          cancelled_count: cancelled.length, skipped_count: skipped.length, errors_count: errors.length,
          cancelled, skipped, errors,
        },
      });
    } catch { /* non-blocking */ }

    return new Response(JSON.stringify({
      ok: true, agreement_id: agreementId, prazo_dias_acordo: prazoDias,
      cancelled, skipped, errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
