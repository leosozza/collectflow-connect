import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["admin", "super_admin"].includes(tenantUser.role)) {
      return new Response(JSON.stringify({ error: "Apenas admins podem executar backfill" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = tenantUser.tenant_id;
    let totalInserted = 0;

    // Helper: batch insert
    async function batchInsert(rows: Record<string, unknown>[]) {
      if (rows.length === 0) return;
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from("client_events").insert(chunk);
        if (error) console.error("Backfill insert error:", error.message);
        else totalInserted += chunk.length;
      }
    }

    // 1. call_dispositions
    const { data: dispositions } = await supabase
      .from("call_dispositions")
      .select("tenant_id, client_id, disposition_type, notes, scheduled_callback, created_at, clients(cpf)")
      .eq("tenant_id", tenantId)
      .limit(5000);

    await batchInsert((dispositions || []).map((d: any) => ({
      tenant_id: d.tenant_id,
      client_id: d.client_id,
      client_cpf: d.clients?.cpf || "",
      event_type: "disposition",
      event_source: "operator",
      event_channel: "call",
      event_value: d.disposition_type,
      metadata: { notes: d.notes, scheduled_callback: d.scheduled_callback },
      created_at: d.created_at,
    })));

    // 2. call_logs
    const { data: callLogs } = await supabase
      .from("call_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .limit(5000);

    await batchInsert((callLogs || []).map((c: any) => ({
      tenant_id: c.tenant_id,
      client_id: c.client_id,
      client_cpf: c.client_cpf || "",
      event_type: "call",
      event_source: "system",
      event_channel: "call",
      event_value: c.status || "unknown",
      metadata: { duration_seconds: c.duration_seconds, agent_name: c.agent_name, campaign_name: c.campaign_name },
      created_at: c.called_at,
    })));

    // 3. chat_messages (only linked conversations)
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, tenant_id, direction, message_type, is_internal, status, created_at, conversations(client_id, clients(cpf))")
      .eq("tenant_id", tenantId)
      .limit(5000);

    const chatEvents = (messages || [])
      .filter((m: any) => m.conversations?.clients?.cpf)
      .map((m: any) => ({
        tenant_id: m.tenant_id,
        client_id: m.conversations.client_id,
        client_cpf: m.conversations.clients.cpf,
        event_type: m.direction === "inbound" ? "whatsapp_inbound" : "whatsapp_outbound",
        event_source: m.is_internal ? "operator" : "system",
        event_channel: "whatsapp",
        event_value: m.message_type,
        metadata: { direction: m.direction, status: m.status },
        created_at: m.created_at,
      }));
    await batchInsert(chatEvents);

    // 4. agreements
    const { data: agreements } = await supabase
      .from("agreements")
      .select("id, tenant_id, client_cpf, status, proposed_total, original_total, created_at")
      .eq("tenant_id", tenantId)
      .limit(5000);

    const agrEvents: Record<string, unknown>[] = [];
    for (const a of agreements || []) {
      const cleanCpf = (a as any).client_cpf?.replace(/\D/g, "") || "";
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("tenant_id", tenantId)
        .or(`cpf.eq.${cleanCpf},cpf.eq.${cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`)
        .limit(1)
        .single();

      agrEvents.push({
        tenant_id: a.tenant_id,
        client_id: client?.id || null,
        client_cpf: (a as any).client_cpf,
        event_type: a.status === "cancelled" ? "agreement_cancelled" : a.status === "approved" ? "agreement_approved" : "agreement_created",
        event_source: "operator",
        event_channel: null,
        event_value: a.status,
        metadata: { agreement_id: a.id, proposed_total: a.proposed_total, original_total: a.original_total },
        created_at: a.created_at,
      });
    }
    await batchInsert(agrEvents);

    // 5. agreement_signatures
    const { data: sigs } = await supabase
      .from("agreement_signatures")
      .select("id, agreement_id, tenant_id, signature_type, signed_at, agreements(client_cpf)")
      .eq("tenant_id", tenantId)
      .limit(5000);

    const sigEvents = (sigs || [])
      .filter((s: any) => s.agreements?.client_cpf)
      .map((s: any) => ({
        tenant_id: s.tenant_id,
        client_id: null,
        client_cpf: s.agreements.client_cpf,
        event_type: "agreement_signed",
        event_source: "operator",
        event_channel: null,
        event_value: s.signature_type,
        metadata: { agreement_id: s.agreement_id },
        created_at: s.signed_at,
      }));
    await batchInsert(sigEvents);

    // 6. message_logs
    const { data: msgLogs } = await supabase
      .from("message_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .limit(5000);

    await batchInsert((msgLogs || []).map((m: any) => ({
      tenant_id: m.tenant_id,
      client_id: null,
      client_cpf: m.client_cpf || "",
      event_type: "message_sent",
      event_source: "prevention",
      event_channel: m.channel || "whatsapp",
      event_value: m.status,
      metadata: { rule_id: m.rule_id, channel: m.channel },
      created_at: m.sent_at,
    })));

    return new Response(JSON.stringify({ success: true, total_events_inserted: totalInserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[backfill-client-events] ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
