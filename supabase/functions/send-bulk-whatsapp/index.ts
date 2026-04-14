import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendByProvider } from "../_shared/whatsapp-sender.ts";
import { resolveTemplate } from "../_shared/template-resolver.ts";
import { logMessage } from "../_shared/message-logger.ts";

// ===== Anti-Ban Constants (HARDCODED — not configurable by frontend) =====
const ANTI_BAN_MIN_DELAY_MS = 8000;   // 8 seconds minimum between messages
const ANTI_BAN_MAX_DELAY_MS = 15000;  // 15 seconds maximum between messages
const BATCH_REST_THRESHOLD = 15;       // pause after every 15 messages per instance
const BATCH_REST_DURATION_MS = 120000; // 2-minute rest between batches
const MAX_EXECUTION_MS = 380000;       // 380s safety margin (Edge Runtime limit ~400s)
const CHUNK_SIZE = 100;

// AI agents can use faster delays (future use)
const AI_AGENT_MIN_DELAY_MS = 3000;
const AI_AGENT_MAX_DELAY_MS = 6000;
const AI_AGENT_BATCH_REST_THRESHOLD = 25;
const AI_AGENT_BATCH_REST_DURATION_MS = 60000;

function getAntiBanDelay(originType: string): number {
  if (originType === "AI_AGENT") {
    return AI_AGENT_MIN_DELAY_MS + Math.random() * (AI_AGENT_MAX_DELAY_MS - AI_AGENT_MIN_DELAY_MS);
  }
  return ANTI_BAN_MIN_DELAY_MS + Math.random() * (ANTI_BAN_MAX_DELAY_MS - ANTI_BAN_MIN_DELAY_MS);
}

function getBatchRestConfig(originType: string): { threshold: number; duration: number } {
  if (originType === "AI_AGENT") {
    return { threshold: AI_AGENT_BATCH_REST_THRESHOLD, duration: AI_AGENT_BATCH_REST_DURATION_MS };
  }
  return { threshold: BATCH_REST_THRESHOLD, duration: BATCH_REST_DURATION_MS };
}

// ===== Helper: persist conversation + outbound message via canonical RPC =====
async function ensureConversationAndMessage(
  supabase: any,
  tenantId: string,
  instanceId: string | null,
  normalizedPhone: string,
  recipientName: string,
  clientId: string | null,
  messageBody: string,
  providerMessageId: string | null,
  provider?: string,
) {
  try {
    const { data: result, error: rpcErr } = await supabase.rpc("ingest_channel_event", {
      _tenant_id: tenantId,
      _endpoint_id: instanceId,
      _channel_type: "whatsapp",
      _provider: provider || null,
      _remote_phone: normalizedPhone,
      _remote_name: recipientName || normalizedPhone,
      _direction: "outbound",
      _message_type: "text",
      _content: messageBody,
      _media_url: null,
      _media_mime_type: null,
      _external_id: providerMessageId || null,
      _provider_message_id: providerMessageId || null,
      _actor_type: "campaign",
      _status: "sent",
    });

    if (rpcErr) {
      console.error("ingest_channel_event error:", rpcErr);
    }
  } catch (err) {
    console.error("ensureConversationAndMessage error:", err);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Validate auth via getUser (robust)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Get user's tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .single();

    if (!tenantUser) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role OR granular RBAC permission
    const isAdmin = ["admin", "super_admin"].includes(tenantUser.role);
    let hasPermission = isAdmin;

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, permission_profile_id")
        .eq("user_id", userId)
        .single();

      if (profile) {
        if (profile.permission_profile_id) {
          const { data: permProfile } = await supabase
            .from("permission_profiles")
            .select("permissions")
            .eq("id", profile.permission_profile_id)
            .single();

          if (permProfile?.permissions) {
            const perms = permProfile.permissions as Record<string, string[]>;
            if (perms.campanhas_whatsapp?.includes("create")) {
              hasPermission = true;
            }
          }
        }

        if (!hasPermission) {
          const { data: overrides } = await supabase
            .from("user_permissions")
            .select("actions")
            .eq("profile_id", profile.id)
            .eq("tenant_id", tenantUser.tenant_id)
            .eq("module", "campanhas_whatsapp")
            .single();

          if (overrides?.actions && (overrides.actions as string[]).includes("create")) {
            hasPermission = true;
          }
        }
      }
    }

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // ===== CAMPAIGN-BASED FLOW =====
    if (body.campaign_id) {
      return await handleCampaignFlow(supabase, body.campaign_id, tenantUser.tenant_id);
    }

    // ===== LEGACY FLOW =====
    return await handleLegacyFlow(supabase, body, tenantUser);
  } catch (err: any) {
    console.error("send-bulk-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== Campaign-based flow with anti-ban throttling + checkpoint =====
async function handleCampaignFlow(supabase: any, campaignId: string, tenantId: string) {
  const startTime = Date.now();

  // Load campaign
  const { data: campaign, error: cErr } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .single();

  if (cErr || !campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Determine origin type for anti-ban config
  const originType: string = campaign.origin_type || "OP_CARTEIRA";
  const batchConfig = getBatchRestConfig(originType);

  // Load tenant settings
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  const tenantSettings = (tenantData?.settings || {}) as Record<string, any>;

  // Update campaign status to sending (only if not already sending — supports resume)
  if (campaign.status !== "sending") {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "sending", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  // Global env vars
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "") || "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
  const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

  // Gupshup config
  const gupshupConfigured = !!(tenantSettings.gupshup_api_key && tenantSettings.gupshup_source_number);

  let totalSent = (campaign.sent_count || 0);
  let totalFailed = (campaign.failed_count || 0);
  let chunkSent = 0;
  let chunkFailed = 0;
  const errors: string[] = [];
  let timedOut = false;

  // Instance cache to avoid repeated lookups
  const instanceCache = new Map<string, any>();

  // Per-instance send counter for batch resting (across all chunks in this invocation)
  const instanceSendCounts = new Map<string, number>();

  // Process in chunks
  while (true) {
    // Check time budget
    if (Date.now() - startTime > MAX_EXECUTION_MS) {
      timedOut = true;
      break;
    }

    // Load next chunk of pending recipients
    const { data: recipients, error: rErr } = await supabase
      .from("whatsapp_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(CHUNK_SIZE);

    if (rErr) throw rErr;
    if (!recipients || recipients.length === 0) break;

    // Pre-load instances for this chunk
    const instanceIds = [...new Set(recipients.map((r: any) => r.assigned_instance_id).filter(Boolean))];
    const missingInstanceIds = instanceIds.filter(id => !instanceCache.has(id));
    if (missingInstanceIds.length > 0) {
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_url, api_key, instance_name, provider")
        .in("id", missingInstanceIds);
      for (const inst of instances || []) {
        instanceCache.set(inst.id, inst);
      }
    }

    // Batch load clients for this chunk
    const clientIds = [...new Set(recipients.map((r: any) => r.representative_client_id).filter(Boolean))];
    const clientMap = new Map<string, any>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor, phone")
        .in("id", clientIds);
      for (const c of clients || []) {
        clientMap.set(c.id, c);
      }
    }

    // Process chunk
    for (const recipient of recipients) {
      // Time check within chunk — leave margin for checkpoint save
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        timedOut = true;
        break;
      }

      const instanceId = recipient.assigned_instance_id || "__gupshup__";
      let inst = instanceCache.get(recipient.assigned_instance_id);

      if (!inst && !recipient.assigned_instance_id && gupshupConfigured) {
        inst = { provider: "gupshup", instance_name: tenantSettings.gupshup_app_name || "gupshup" };
      }

      if (!inst) {
        await supabase
          .from("whatsapp_campaign_recipients")
          .update({ status: "failed", error_message: "Instância não encontrada", updated_at: new Date().toISOString() })
          .eq("id", recipient.id);
        chunkFailed++;
        totalFailed++;

        // Update checkpoint after each message
        await supabase
          .from("whatsapp_campaigns")
          .update({
            sent_count: totalSent,
            failed_count: totalFailed,
            progress_metadata: { processed: totalSent + totalFailed, last_chunk_at: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);

        continue;
      }

      // ===== BATCH RESTING: Check if this instance needs a pause =====
      const currentCount = instanceSendCounts.get(instanceId) || 0;
      if (currentCount > 0 && currentCount % batchConfig.threshold === 0) {
        console.log(`[Anti-Ban] Batch rest for instance ${instanceId}: ${batchConfig.duration}ms pause after ${currentCount} messages`);

        // Check if we have enough time for the rest
        const timeRemaining = MAX_EXECUTION_MS - (Date.now() - startTime);
        if (timeRemaining < batchConfig.duration + 20000) {
          // Not enough time for rest + at least one more message — checkpoint and exit
          timedOut = true;
          break;
        }

        // Save checkpoint before long pause
        await supabase
          .from("whatsapp_campaigns")
          .update({
            sent_count: totalSent,
            failed_count: totalFailed,
            progress_metadata: {
              processed: totalSent + totalFailed,
              batch_resting: true,
              instance_id: instanceId,
              last_chunk_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);

        await new Promise((r) => setTimeout(r, batchConfig.duration));
      }

      const client = clientMap.get(recipient.representative_client_id) || null;
      const rawMessage = recipient.message_body_snapshot || campaign.message_body || "";
      const message = client ? resolveTemplate(rawMessage, client) : rawMessage;

      try {
        const sendResult = await sendByProvider(
          inst, recipient.phone, message, tenantSettings,
          evolutionUrl, evolutionKey, wuzapiUrl, wuzapiAdminToken
        );

        const status = sendResult.ok ? "sent" : "failed";

        await supabase
          .from("whatsapp_campaign_recipients")
          .update({
            status,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            error_message: status === "failed" ? JSON.stringify(sendResult.result) : null,
            provider_message_id: sendResult.providerMessageId,
            message_body_snapshot: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        await logMessage(supabase, {
          tenant_id: tenantId,
          client_id: recipient.representative_client_id,
          client_cpf: client?.cpf || null,
          phone: recipient.phone,
          status,
          message_body: message,
          error_message: status === "failed" ? JSON.stringify(sendResult.result) : null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
          metadata: {
            source_type: "campaign",
            campaign_id: campaignId,
            instance_id: recipient.assigned_instance_id,
            instance_name: inst.instance_name,
            provider: sendResult.provider,
            provider_message_id: sendResult.providerMessageId,
          },
        });

        if (status === "sent") {
          chunkSent++;
          totalSent++;
          instanceSendCounts.set(instanceId, (instanceSendCounts.get(instanceId) || 0) + 1);
          await ensureConversationAndMessage(
            supabase, tenantId, recipient.assigned_instance_id,
            recipient.phone, recipient.recipient_name,
            recipient.representative_client_id, message,
            sendResult.providerMessageId, sendResult.provider
          );
        } else {
          chunkFailed++;
          totalFailed++;
          errors.push(`${recipient.recipient_name}: envio falhou`);
        }
      } catch (err: any) {
        await supabase
          .from("whatsapp_campaign_recipients")
          .update({
            status: "failed",
            error_message: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        await logMessage(supabase, {
          tenant_id: tenantId,
          client_id: recipient.representative_client_id,
          client_cpf: client?.cpf || null,
          phone: recipient.phone,
          status: "failed",
          message_body: message,
          error_message: err.message,
          metadata: {
            source_type: "campaign",
            campaign_id: campaignId,
            instance_id: recipient.assigned_instance_id,
            instance_name: inst.instance_name,
            provider: inst.provider,
          },
        });

        chunkFailed++;
        totalFailed++;
        errors.push(`${recipient.recipient_name}: ${err.message}`);
      }

      // ===== ANTI-BAN THROTTLE: Random delay between messages =====
      const delay = getAntiBanDelay(originType);
      console.log(`[Anti-Ban] Waiting ${Math.round(delay)}ms before next message (origin: ${originType})`);
      await new Promise((r) => setTimeout(r, delay));

      // Update checkpoint after EACH message for real-time polling
      await supabase
        .from("whatsapp_campaigns")
        .update({
          sent_count: totalSent,
          failed_count: totalFailed,
          progress_metadata: {
            processed: totalSent + totalFailed,
            last_chunk_at: new Date().toISOString(),
            anti_ban_active: true,
            origin_type: originType,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    }

    if (timedOut) break;
  }

  // Check if there are still pending recipients
  const { count: remainingCount } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const remaining = remainingCount || 0;

  if (timedOut && remaining > 0) {
    // Partial completion — campaign stays in "sending" status for re-invocation
    await supabase
      .from("whatsapp_campaigns")
      .update({
        sent_count: totalSent,
        failed_count: totalFailed,
        progress_metadata: {
          processed: totalSent + totalFailed,
          remaining,
          timed_out: true,
          last_chunk_at: new Date().toISOString(),
          anti_ban_active: true,
          origin_type: originType,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({ status: "partial", sent: chunkSent, failed: chunkFailed, totalSent, totalFailed, remaining, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Determine final status
  let finalStatus = "completed";
  if (totalSent === 0 && totalFailed > 0) finalStatus = "failed";
  else if (totalSent > 0 && totalFailed > 0) finalStatus = "completed_with_errors";

  await supabase
    .from("whatsapp_campaigns")
    .update({
      status: finalStatus,
      sent_count: totalSent,
      failed_count: totalFailed,
      completed_at: new Date().toISOString(),
      progress_metadata: { processed: totalSent + totalFailed, remaining: 0, anti_ban_active: true },
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return new Response(
    JSON.stringify({ success: true, sent: totalSent, failed: totalFailed, total: totalSent + totalFailed, errors, finalStatus }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ===== Legacy flow (backward compatible) =====
async function handleLegacyFlow(supabase: any, body: any, tenantUser: any) {
  const { client_ids, message_template } = body;

  if (!client_ids?.length || !message_template) {
    return new Response(JSON.stringify({ error: "client_ids and message_template required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantUser.tenant_id)
    .single();

  const settings = (tenant?.settings || {}) as Record<string, any>;
  const provider = settings.whatsapp_provider || (settings.gupshup_api_key ? "gupshup" : settings.baylers_api_key ? "baylers" : "");

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "") || "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
  const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

  let inst: any = null;

  if (provider === "baylers") {
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("instance_url, api_key, instance_name, provider")
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("is_default", true)
      .eq("status", "active")
      .limit(1)
      .single();

    if (instances) {
      inst = {
        provider: "baylers",
        instance_url: instances.instance_url || evolutionUrl,
        api_key: instances.api_key || evolutionKey,
        instance_name: instances.instance_name,
      };
    } else if (settings.baylers_api_key && settings.baylers_instance_url) {
      inst = {
        provider: "baylers",
        instance_url: settings.baylers_instance_url,
        api_key: settings.baylers_api_key,
        instance_name: settings.baylers_instance_name || "default",
      };
    }
  } else if (provider === "gupshup") {
    inst = { provider: "gupshup", instance_name: settings.gupshup_app_name || "gupshup" };
  }

  if (provider === "gupshup" && (!settings.gupshup_api_key || !settings.gupshup_source_number)) {
    return new Response(JSON.stringify({ error: "Gupshup credentials not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (provider === "baylers" && !inst) {
    return new Response(JSON.stringify({ error: "Baylers credentials not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!provider) {
    return new Response(JSON.stringify({ error: "No WhatsApp provider configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: clients, error: cErr } = await supabase
    .from("clients")
    .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor, phone")
    .eq("tenant_id", tenantUser.tenant_id)
    .in("id", client_ids);

  if (cErr) throw cErr;

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const client of clients || []) {
    const message = resolveTemplate(message_template, client);

    if (!client.phone) {
      await logMessage(supabase, {
        tenant_id: tenantUser.tenant_id,
        client_id: client.id,
        client_cpf: client.cpf,
        status: "failed",
        message_body: message,
        error_message: "Cliente sem telefone",
        metadata: { source_type: "legacy", provider },
      });
      failed++;
      errors.push(`${client.nome_completo}: sem telefone`);
      continue;
    }

    const phone = client.phone.replace(/\D/g, "");

    try {
      const sendResult = await sendByProvider(
        inst!, phone, message, settings,
        evolutionUrl, evolutionKey, wuzapiUrl, wuzapiAdminToken
      );

      const status = sendResult.ok ? "sent" : "failed";

      await logMessage(supabase, {
        tenant_id: tenantUser.tenant_id,
        client_id: client.id,
        client_cpf: client.cpf,
        phone,
        status,
        message_body: message,
        error_message: status === "failed" ? JSON.stringify(sendResult.result) : null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        metadata: {
          source_type: "legacy",
          provider: sendResult.provider,
          provider_message_id: sendResult.providerMessageId,
          instance_name: inst?.instance_name,
        },
      });

      if (status === "sent") {
        sent++;
        await ensureConversationAndMessage(
          supabase, tenantUser.tenant_id, inst?.id || null,
          phone, client.nome_completo, client.id, message,
          sendResult.providerMessageId, sendResult.provider
        );
      } else { failed++; errors.push(`${client.nome_completo}: envio falhou`); }

      await new Promise((r) => setTimeout(r, 100));
    } catch (err: any) {
      await logMessage(supabase, {
        tenant_id: tenantUser.tenant_id,
        client_id: client.id,
        client_cpf: client.cpf,
        phone,
        status: "failed",
        message_body: message,
        error_message: err.message,
        metadata: { source_type: "legacy", provider },
      });
      failed++;
      errors.push(`${client.nome_completo}: ${err.message}`);
    }
  }

  return new Response(
    JSON.stringify({ success: true, sent, failed, total: (clients || []).length, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
