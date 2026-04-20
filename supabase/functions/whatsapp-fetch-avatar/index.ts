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

    // Resolve user's tenant
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

    // Load conversations (filter by tenant for safety) + instance info
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

    // Collect unique instances
    const instanceIds = Array.from(new Set((convs || []).map((c: any) => c.endpoint_id || c.instance_id).filter(Boolean)));
    const { data: insts } = instanceIds.length
      ? await admin.from("whatsapp_instances").select("id, provider_category, instance_name, instance_url, api_key").in("id", instanceIds)
      : { data: [] as any[] };
    const instMap = new Map<string, any>((insts || []).map((i: any) => [i.id, i]));

    const evolutionUrl = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

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
        results[conv.id] = { url: null, cached: false };
        continue;
      }

      const category = (inst.provider_category || "").toLowerCase();
      let avatarUrl: string | null = null;

      try {
        if (category === "evolution" || category === "unofficial_evolution") {
          if (evolutionUrl && evolutionKey && inst.instance_name) {
            const resp = await fetch(
              `${evolutionUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(inst.instance_name)}`,
              {
                method: "POST",
                headers: { apikey: evolutionKey, "Content-Type": "application/json" },
                body: JSON.stringify({ number: conv.remote_phone }),
              }
            );
            if (resp.ok) {
              const json = await resp.json().catch(() => ({}));
              avatarUrl = json?.profilePictureUrl || json?.url || null;
            }
          }
        } else if (category === "wuzapi" || category === "unofficial_wuzapi") {
          const baseUrl = (inst.instance_url || "").replace(/\/+$/, "");
          const apiKey = inst.api_key || "";
          if (baseUrl && apiKey) {
            const resp = await fetch(
              `${baseUrl}/user/avatar?phone=${encodeURIComponent(conv.remote_phone)}`,
              { method: "GET", headers: { Token: apiKey } }
            );
            if (resp.ok) {
              const json = await resp.json().catch(() => ({}));
              avatarUrl = json?.url || json?.data?.URL || json?.data?.url || null;
            }
          }
        }
        // official_meta / official / gupshup → not supported, leave null
      } catch (err) {
        console.error("[whatsapp-fetch-avatar] provider error", conv.id, err);
        avatarUrl = null;
      }

      // Persist (even null, to flag attempted)
      await admin
        .from("conversations")
        .update({
          remote_avatar_url: avatarUrl,
          remote_avatar_fetched_at: new Date().toISOString(),
        })
        .eq("id", conv.id);

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
