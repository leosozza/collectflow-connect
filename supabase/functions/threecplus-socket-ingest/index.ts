// Edge Function: receives a batch of raw 3CPLUS Socket.IO events and persists
// them in `threecplus_socket_events`. Dedup is enforced by a partial unique
// index on (tenant_id, event_name, external_call_id, payload->>status).
//
// The function is callable by authenticated users only — it uses the caller's
// JWT to enforce RLS (insert policy already restricts to the user's tenant).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EventInput {
  tenant_id: string;
  event_name: string;
  external_company_id?: string | null;
  external_agent_id?: string | null;
  external_call_id?: string | null;
  external_campaign_id?: string | null;
  phone?: string | null;
  payload?: Record<string, unknown>;
  received_at?: string;
}

function pickStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing_authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = await req.json().catch(() => null);
    const events: EventInput[] = Array.isArray(body?.events) ? body.events : [];
    if (events.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap batch size for safety
    const MAX_BATCH = 200;
    const batch = events.slice(0, MAX_BATCH).map((e) => ({
      tenant_id: e.tenant_id,
      event_name: e.event_name,
      external_company_id: pickStr(e.external_company_id),
      external_agent_id: pickStr(e.external_agent_id),
      external_call_id: pickStr(e.external_call_id),
      external_campaign_id: pickStr(e.external_campaign_id),
      phone: pickStr(e.phone),
      payload: e.payload ?? {},
      received_at: e.received_at || new Date().toISOString(),
    }));

    // Use upsert with onConflict against the partial dedup index when call_id present.
    // For events without call_id we just insert.
    const withCall = batch.filter((b) => !!b.external_call_id);
    const withoutCall = batch.filter((b) => !b.external_call_id);

    let inserted = 0;
    if (withCall.length > 0) {
      const { error, count } = await client
        .from("threecplus_socket_events")
        .upsert(withCall, { onConflict: "tenant_id,event_name,external_call_id", ignoreDuplicates: true, count: "exact" });
      if (error) {
        // Fallback to plain insert if upsert column constraint isn't supported in shape
        const { error: insErr, count: insCount } = await client
          .from("threecplus_socket_events")
          .insert(withCall, { count: "exact" });
        if (insErr) throw insErr;
        inserted += insCount ?? withCall.length;
      } else {
        inserted += count ?? withCall.length;
      }
    }
    if (withoutCall.length > 0) {
      const { error, count } = await client
        .from("threecplus_socket_events")
        .insert(withoutCall, { count: "exact" });
      if (error) throw error;
      inserted += count ?? withoutCall.length;
    }

    return new Response(JSON.stringify({ inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("threecplus-socket-ingest error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
