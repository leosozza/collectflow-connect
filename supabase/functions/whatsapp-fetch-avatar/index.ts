import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const conversationIds: string[] = Array.isArray(body?.conversation_ids)
      ? body.conversation_ids.filter((x: any) => typeof x === "string")
      : (typeof body?.conversation_id === "string" ? [body.conversation_id] : []);

    if (conversationIds.length === 0) {
      return new Response(JSON.stringify({ error: "conversation_id(s) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenantRow } = await userClient
      .from("tenant_users")
      .select("tenant_id")
      .limit(1)
      .maybeSingle();
    const tenantId = tenantRow?.tenant_id as string | undefined;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: convs, error: convErr } = await admin
      .from("conversations")
      .select("id, tenant_id, instance_id, endpoint_id, remote_phone, remote_avatar_url, remote_avatar_fetched_at")
      .in("id", conversationIds)
      .eq("tenant_id", tenantId);

    if (convErr) {
      return new Response(JSON.stringify({ error: convErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { url: string | null; cached: boolean }> = {};
    const now = Date.now();

    const instanceIds = Array.from(new Set((convs || []).map((c: any) => c.endpoint_id || c.instance_id).filter(Boolean)));
    const { data: insts } = instanceIds.length
      ? await admin.from("whatsapp_instances").select("id, provider, provider_category, instance_name, instance_url, api_key").in("id", instanceIds)
      : { data: [] as any[] };
    const instMap = new Map<string, any>((insts || []).map((i: any) => [i.id, i]));

    const EVOLUTION_API_URL_GLOBAL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const EVOLUTION_API_KEY_GLOBAL = Deno.env.get("EVOLUTION_API_KEY") || "";

    for (const conv of (convs || []) as any[]) {
      // TTL cache
      if (conv.remote_avatar_fetched_at) {
        const fetchedMs = new Date(conv.remote_avatar_fetched_at).getTime();
        if (now - fetchedMs < TTL_MS) {
          results[conv.id] = { url: conv.remote_avatar_url || null, cached: true };
          continue;
        }
      }

      const inst = instMap.get(conv.endpoint_id || conv.instance_id);
      if (!inst) {
        console.log("[avatar] conv", conv.id, "no instance");
        results[conv.id] = { url: null, cached: false };
        continue;
      }

      const kind = `${inst.provider || ""} ${inst.provider_category || ""}`.toLowerCase();
      let avatarUrl: string | null = null;
      let httpResponded = false; // only set fetched_at if we actually got a response (or category unsupported)

      try {
        if (kind.includes("evolution")) {
          const baseUrl = (inst.instance_url || EVOLUTION_API_URL_GLOBAL).replace(/\/+$/, "");
          const apiKey = inst.api_key || EVOLUTION_API_KEY_GLOBAL;
          console.log("[avatar] conv", conv.id, "kind=evolution host=", baseUrl, "instance=", inst.instance_name);

          if (baseUrl && apiKey && inst.instance_name) {
            const resp = await fetch(
              `${baseUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(inst.instance_name)}`,
              {
                method: "POST",
                headers: { apikey: apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ number: conv.remote_phone }),
              }
            );
            httpResponded = resp.status < 500; // treat 5xx as transient → retry next time
            const json = await resp.json().catch(() => ({}));
            avatarUrl = json?.profilePictureUrl || json?.url || null;
            console.log("[avatar] result", conv.id, "status=", resp.status, "url=", avatarUrl);
          } else {
            console.log("[avatar] conv", conv.id, "evolution missing creds (baseUrl/apiKey/instance_name)");
            httpResponded = true; // mark as attempted to avoid hot loop
          }
        } else if (kind.includes("wuzapi")) {
          const baseUrl = (inst.instance_url || "").replace(/\/+$/, "");
          const apiKey = inst.api_key || "";
          console.log("[avatar] conv", conv.id, "kind=wuzapi host=", baseUrl);
          if (baseUrl && apiKey) {
            const resp = await fetch(
              `${baseUrl}/user/avatar?phone=${encodeURIComponent(conv.remote_phone)}`,
              { method: "GET", headers: { Token: apiKey } }
            );
            httpResponded = resp.status < 500;
            const json = await resp.json().catch(() => ({}));
            avatarUrl = json?.url || json?.data?.URL || json?.data?.url || null;
            console.log("[avatar] result", conv.id, "status=", resp.status, "url=", avatarUrl);
          } else {
            httpResponded = true;
          }
        } else {
          // official_meta / gupshup / unknown → unsupported, mark attempted to avoid retries
          console.log("[avatar] conv", conv.id, "unsupported kind=", kind);
          httpResponded = true;
        }
      } catch (err) {
        console.error("[avatar] provider error", conv.id, err);
        avatarUrl = null;
        httpResponded = false; // network error → allow retry
      }

      const updatePayload: Record<string, any> = { remote_avatar_url: avatarUrl };
      if (httpResponded) updatePayload.remote_avatar_fetched_at = new Date().toISOString();

      await admin.from("conversations").update(updatePayload).eq("id", conv.id);

      results[conv.id] = { url: avatarUrl, cached: false };
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[whatsapp-fetch-avatar] fatal", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
