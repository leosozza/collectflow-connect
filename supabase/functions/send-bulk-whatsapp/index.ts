import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendByProvider } from "../_shared/whatsapp-sender.ts";
import { resolveTemplate } from "../_shared/template-resolver.ts";
import { logMessage } from "../_shared/message-logger.ts";

// ===== Anti-Ban Constants — UNOFFICIAL (conservative) =====
const UNOFFICIAL_MIN_DELAY_MS = 8000;
const UNOFFICIAL_MAX_DELAY_MS = 15000;
const UNOFFICIAL_BATCH_THRESHOLD = 15;
const UNOFFICIAL_BATCH_REST_MS = 120000; // 2 min

// ===== Official Provider Constants (relaxed) =====
const OFFICIAL_MIN_DELAY_MS = 1000;
const OFFICIAL_MAX_DELAY_MS = 3000;
const OFFICIAL_BATCH_THRESHOLD = 50;
const OFFICIAL_BATCH_REST_MS = 30000; // 30s

// ===== AI Agent Constants =====
const AI_AGENT_MIN_DELAY_MS = 3000;
const AI_AGENT_MAX_DELAY_MS = 6000;
const AI_AGENT_BATCH_THRESHOLD = 25;
const AI_AGENT_BATCH_REST_MS = 60000;

// Edge runtime hard limit is 150s. Exit at 120s so we have time to
// mark remaining recipients + self-retrigger before the platform kills us.
const MAX_EXECUTION_MS = 120000;

interface ThrottleConfig {
  minDelay: number;
  maxDelay: number;
  batchThreshold: number;
  batchRestMs: number;
}

function getThrottleConfig(providerCategory: string, originType: string): ThrottleConfig {
  if (originType === "AI_AGENT") {
    return { minDelay: AI_AGENT_MIN_DELAY_MS, maxDelay: AI_AGENT_MAX_DELAY_MS, batchThreshold: AI_AGENT_BATCH_THRESHOLD, batchRestMs: AI_AGENT_BATCH_REST_MS };
  }
  if (providerCategory === "official_meta") {
    return { minDelay: OFFICIAL_MIN_DELAY_MS, maxDelay: OFFICIAL_MAX_DELAY_MS, batchThreshold: OFFICIAL_BATCH_THRESHOLD, batchRestMs: OFFICIAL_BATCH_REST_MS };
  }
  // unofficial / mixed — conservative
  return { minDelay: UNOFFICIAL_MIN_DELAY_MS, maxDelay: UNOFFICIAL_MAX_DELAY_MS, batchThreshold: UNOFFICIAL_BATCH_THRESHOLD, batchRestMs: UNOFFICIAL_BATCH_REST_MS };
}

function randomDelay(cfg: ThrottleConfig): number {
  return cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay);
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
    const { error: rpcErr } = await supabase.rpc("ingest_channel_event", {
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
    if (rpcErr) console.error("ingest_channel_event error:", rpcErr);
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
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .single();

    if (!tenantUser) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission check
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
            if (perms.campanhas_whatsapp?.includes("create")) hasPermission = true;
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
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    if (body.campaign_id) {
      return await handleCampaignFlow(supabase, body.campaign_id, tenantUser.tenant_id);
    }

    // Legacy flow — apply same anti-ban rules
    return await handleLegacyFlow(supabase, body, tenantUser);
  } catch (err: any) {
    console.error("send-bulk-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== Campaign flow with campaign lock, atomic claims, per-instance queuing =====
async function handleCampaignFlow(supabase: any, campaignId: string, tenantId: string) {
  const startTime = Date.now();
  const workerId = `worker_${crypto.randomUUID().slice(0, 8)}`;

  // Load campaign
  const { data: campaign, error: cErr } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .single();

  if (cErr || !campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ===== BLOCK MIXED CAMPAIGNS =====
  if (campaign.provider_category === "mixed") {
    return new Response(JSON.stringify({ error: "Campanhas mistas (oficial + não-oficial) não são permitidas. Crie campanhas separadas." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ===== CAMPAIGN LOCK: prevent duplicate processing =====
  const { data: lockAcquired } = await supabase.rpc("try_lock_campaign", {
    _campaign_id: campaignId,
    _worker_id: workerId,
  });

  if (!lockAcquired) {
    console.log(`[Campaign] Lock not acquired for ${campaignId} — another worker is processing`);
    return new Response(JSON.stringify({ error: "Campanha já está sendo processada por outro worker", status: "locked" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ===== AUTO-HEAL: free orphan recipients stuck in `processing` (>5min) =====
  // A previous worker died mid-chunk leaving recipients flagged as `processing`.
  // Now that we hold the lock, reclaim them so this run can actually drain the queue.
  try {
    const orphanCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { error: healErr, count: healed } = await supabase
      .from("whatsapp_campaign_recipients")
      .update({ status: "pending", updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("campaign_id", campaignId)
      .eq("status", "processing")
      .lt("updated_at", orphanCutoff);
    if (healErr) console.error(`[Campaign ${campaignId}] auto-heal orphan recipients failed:`, healErr.message);
    else if ((healed || 0) > 0) console.log(`[Campaign ${campaignId}] auto-heal: requeued ${healed} orphan recipient(s)`);
  } catch (e: any) {
    console.error(`[Campaign ${campaignId}] auto-heal exception:`, e?.message);
  }

  const originType: string = campaign.origin_type || "OP_CARTEIRA";
  const providerCategory: string = campaign.provider_category || "unofficial";
  const throttle = getThrottleConfig(providerCategory, originType);

  // Load tenant settings
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  const tenantSettings = (tenantData?.settings || {}) as Record<string, any>;

  // Update campaign status to sending
  if (campaign.status !== "sending") {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "sending", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", campaignId);
  }

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "") || "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
  const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";
  const gupshupConfigured = !!(tenantSettings.gupshup_api_key && tenantSettings.gupshup_source_number);

  let totalSent = campaign.sent_count || 0;
  let totalFailed = campaign.failed_count || 0;
  let chunkSent = 0;
  let chunkFailed = 0;
  const errors: string[] = [];
  let timedOut = false;

  const instanceCache = new Map<string, any>();

  // ===== Get all unique instance IDs for this campaign =====
  const { data: instanceRows } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("assigned_instance_id")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const uniqueInstanceIds = [...new Set((instanceRows || []).map((r: any) => r.assigned_instance_id).filter(Boolean))];
  // Include null for gupshup recipients
  const hasGupshupRecipients = (instanceRows || []).some((r: any) => !r.assigned_instance_id);
  if (hasGupshupRecipients) uniqueInstanceIds.push(null as any);

  // Pre-load all instances
  const realInstanceIds = uniqueInstanceIds.filter(Boolean);
  if (realInstanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_url, api_key, instance_name, provider")
      .in("id", realInstanceIds);
    for (const inst of instances || []) {
      instanceCache.set(inst.id, inst);
    }
  }

  // Per-instance send counters for batch resting
  const instanceSendCounts = new Map<string, number>();

  // ===== INTERLEAVED PER-INSTANCE PROCESSING =====
  // Instead of processing all recipients globally, we round-robin across instances
  // so each instance gets proper cooldown time while others send

  while (true) {
    if (Date.now() - startTime > MAX_EXECUTION_MS) {
      timedOut = true;
      break;
    }

    let anyProcessed = false;

    // Process one recipient from each instance in round-robin
    for (const instId of uniqueInstanceIds) {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        timedOut = true;
        break;
      }

      const instanceKey = instId || "__gupshup__";

      // ===== BATCH RESTING per instance =====
      const currentCount = instanceSendCounts.get(instanceKey) || 0;
      if (currentCount > 0 && currentCount % throttle.batchThreshold === 0) {
        console.log(`[Anti-Ban] Batch rest for instance ${instanceKey}: ${throttle.batchRestMs}ms after ${currentCount} messages`);
        const timeRemaining = MAX_EXECUTION_MS - (Date.now() - startTime);
        if (timeRemaining < throttle.batchRestMs + 20000) {
          timedOut = true;
          break;
        }

        await supabase.from("whatsapp_campaigns").update({
          sent_count: totalSent, failed_count: totalFailed,
          progress_metadata: {
            processed: totalSent + totalFailed, batch_resting: true,
            resting_instance: instanceKey, last_chunk_at: new Date().toISOString(),
            anti_ban_active: true, provider_category: providerCategory,
          },
          updated_at: new Date().toISOString(),
        }).eq("id", campaignId);

        await new Promise((r) => setTimeout(r, throttle.batchRestMs));
      }

      // ===== ATOMIC CLAIM: get next recipient for this instance =====
      let recipients: any[] = [];

      if (instId) {
        const { data } = await supabase.rpc("claim_campaign_recipients", {
          _campaign_id: campaignId,
          _instance_id: instId,
          _worker_id: workerId,
          _limit: 1,
        });
        recipients = data || [];
      } else {
        // Gupshup (null instance_id) — claim manually
        const { data: pending } = await supabase
          .from("whatsapp_campaign_recipients")
          .select("*")
          .eq("campaign_id", campaignId)
          .is("assigned_instance_id", null)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(1);

        if (pending && pending.length > 0) {
          await supabase.from("whatsapp_campaign_recipients")
            .update({ status: "processing", claimed_at: new Date().toISOString(), claimed_by: workerId })
            .eq("id", pending[0].id)
            .eq("status", "pending");
          recipients = pending;
        }
      }

      if (recipients.length === 0) continue;
      anyProcessed = true;

      const recipient = recipients[0];
      let inst = instanceCache.get(recipient.assigned_instance_id);

      if (!inst && !recipient.assigned_instance_id && gupshupConfigured) {
        inst = { provider: "gupshup", instance_name: tenantSettings.gupshup_app_name || "gupshup" };
      }

      if (!inst) {
        await supabase.from("whatsapp_campaign_recipients").update({
          status: "failed", error_message: "Instância não encontrada", updated_at: new Date().toISOString(),
        }).eq("id", recipient.id);
        chunkFailed++; totalFailed++;
        await updateCheckpoint(supabase, campaignId, totalSent, totalFailed, providerCategory);
        continue;
      }

      // Load client data for template resolution
      let client: any = null;
      if (recipient.representative_client_id) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor, phone")
          .eq("id", recipient.representative_client_id)
          .single();
        client = clientData;
      }

      const rawMessage = recipient.message_body_snapshot || campaign.message_body || "";
      const message = client ? resolveTemplate(rawMessage, client) : rawMessage;

      try {
        const sendResult = await sendByProvider(
          inst, recipient.phone, message, tenantSettings,
          evolutionUrl, evolutionKey, wuzapiUrl, wuzapiAdminToken
        );

        const status = sendResult.ok ? "sent" : "failed";

        await supabase.from("whatsapp_campaign_recipients").update({
          status,
          sent_at: status === "sent" ? new Date().toISOString() : null,
          error_message: status === "failed" ? JSON.stringify(sendResult.result) : null,
          provider_message_id: sendResult.providerMessageId,
          message_body_snapshot: message,
          updated_at: new Date().toISOString(),
        }).eq("id", recipient.id);

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
            source_type: "campaign", campaign_id: campaignId,
            instance_id: recipient.assigned_instance_id,
            instance_name: inst.instance_name,
            provider: sendResult.provider,
            provider_message_id: sendResult.providerMessageId,
          },
        });

        if (status === "sent") {
          chunkSent++; totalSent++;
          instanceSendCounts.set(instanceKey, (instanceSendCounts.get(instanceKey) || 0) + 1);
          await ensureConversationAndMessage(
            supabase, tenantId, recipient.assigned_instance_id,
            recipient.phone, recipient.recipient_name,
            recipient.representative_client_id, message,
            sendResult.providerMessageId, sendResult.provider
          );
        } else {
          chunkFailed++; totalFailed++;
          errors.push(`${recipient.recipient_name}: envio falhou`);
        }
      } catch (err: any) {
        await supabase.from("whatsapp_campaign_recipients").update({
          status: "failed", error_message: err.message, updated_at: new Date().toISOString(),
        }).eq("id", recipient.id);

        await logMessage(supabase, {
          tenant_id: tenantId,
          client_id: recipient.representative_client_id,
          client_cpf: client?.cpf || null,
          phone: recipient.phone, status: "failed",
          message_body: message, error_message: err.message,
          metadata: { source_type: "campaign", campaign_id: campaignId, instance_id: recipient.assigned_instance_id, instance_name: inst.instance_name, provider: inst.provider },
        });

        chunkFailed++; totalFailed++;
        errors.push(`${recipient.recipient_name}: ${err.message}`);
      }

      // ===== ANTI-BAN THROTTLE =====
      const delay = randomDelay(throttle);
      console.log(`[Anti-Ban] Instance ${instanceKey}: waiting ${Math.round(delay)}ms (${providerCategory})`);
      await new Promise((r) => setTimeout(r, delay));

      await updateCheckpoint(supabase, campaignId, totalSent, totalFailed, providerCategory);
    }

    if (timedOut) break;
    if (!anyProcessed) break; // All instances exhausted
  }

  // Check remaining
  const { count: remainingCount } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "processing"]);

  const remaining = remainingCount || 0;

  // Release campaign lock
  await supabase.rpc("release_campaign_lock", { _campaign_id: campaignId, _worker_id: workerId });

  if (timedOut && remaining > 0) {
    // Reset any "processing" back to "pending" for retry
    await supabase.from("whatsapp_campaign_recipients")
      .update({ status: "pending", claimed_at: null, claimed_by: null })
      .eq("campaign_id", campaignId)
      .eq("status", "processing");

    await supabase.from("whatsapp_campaigns").update({
      sent_count: totalSent, failed_count: totalFailed,
      progress_metadata: {
        processed: totalSent + totalFailed, remaining,
        timed_out: true, last_chunk_at: new Date().toISOString(),
        anti_ban_active: true, provider_category: providerCategory,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    // Self-retrigger: fire-and-forget POST to ourselves so processing
    // resumes immediately instead of waiting up to 1min for the cron
    // watchdog. The released lock + try_lock_campaign protect against
    // duplicate workers.
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      console.log(`[Campaign ${campaignId}] Timed out with ${remaining} pending — self-retriggering`);
      const retriggerPromise = fetch(`${supabaseUrl}/functions/v1/send-bulk-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      }).catch((e) => console.log(`[Campaign ${campaignId}] self-retrigger failed:`, e?.message));
      // Keep the runtime alive until the retrigger request actually leaves the worker.
      // @ts-ignore EdgeRuntime is provided by the Supabase Edge Runtime
      try { EdgeRuntime.waitUntil(retriggerPromise); } catch { /* ignore in non-edge envs */ }
    }

    return new Response(
      JSON.stringify({ status: "partial", sent: chunkSent, failed: chunkFailed, totalSent, totalFailed, remaining, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let finalStatus = "completed";
  if (totalSent === 0 && totalFailed > 0) finalStatus = "failed";
  else if (totalSent > 0 && totalFailed > 0) finalStatus = "completed_with_errors";

  await supabase.from("whatsapp_campaigns").update({
    status: finalStatus, sent_count: totalSent, failed_count: totalFailed,
    completed_at: new Date().toISOString(),
    progress_metadata: { processed: totalSent + totalFailed, remaining: 0, anti_ban_active: true, provider_category: providerCategory },
    updated_at: new Date().toISOString(),
  }).eq("id", campaignId);

  return new Response(
    JSON.stringify({ success: true, sent: totalSent, failed: totalFailed, total: totalSent + totalFailed, errors, finalStatus }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function updateCheckpoint(supabase: any, campaignId: string, totalSent: number, totalFailed: number, providerCategory: string) {
  await supabase.from("whatsapp_campaigns").update({
    sent_count: totalSent, failed_count: totalFailed,
    progress_metadata: {
      processed: totalSent + totalFailed,
      last_chunk_at: new Date().toISOString(),
      anti_ban_active: true, provider_category: providerCategory,
    },
    updated_at: new Date().toISOString(),
  }).eq("id", campaignId);
}

// ===== Legacy flow — now with proper anti-ban for unofficial =====
async function handleLegacyFlow(supabase: any, body: any, tenantUser: any) {
  const { client_ids, message_template } = body;

  if (!client_ids?.length || !message_template) {
    return new Response(JSON.stringify({ error: "client_ids and message_template required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If more than 5 recipients, block legacy flow — must use campaign
  if (client_ids.length > 5) {
    return new Response(JSON.stringify({ error: "Para mais de 5 destinatários, use o módulo de campanhas" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  let isOfficial = false;

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
      inst = { provider: "baylers", instance_url: instances.instance_url || evolutionUrl, api_key: instances.api_key || evolutionKey, instance_name: instances.instance_name };
    } else if (settings.baylers_api_key && settings.baylers_instance_url) {
      inst = { provider: "baylers", instance_url: settings.baylers_instance_url, api_key: settings.baylers_api_key, instance_name: settings.baylers_instance_name || "default" };
    }
  } else if (provider === "gupshup") {
    inst = { provider: "gupshup", instance_name: settings.gupshup_app_name || "gupshup" };
    isOfficial = true;
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

  // Apply appropriate delay even for legacy
  const throttle = getThrottleConfig(isOfficial ? "official_meta" : "unofficial", "OP_CARTEIRA");

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
        tenant_id: tenantUser.tenant_id, client_id: client.id, client_cpf: client.cpf,
        status: "failed", message_body: message, error_message: "Cliente sem telefone",
        metadata: { source_type: "legacy", provider },
      });
      failed++;
      errors.push(`${client.nome_completo}: sem telefone`);
      continue;
    }

    const phone = client.phone.replace(/\D/g, "");

    try {
      const sendResult = await sendByProvider(inst!, phone, message, settings, evolutionUrl, evolutionKey, wuzapiUrl, wuzapiAdminToken);
      const status = sendResult.ok ? "sent" : "failed";

      await logMessage(supabase, {
        tenant_id: tenantUser.tenant_id, client_id: client.id, client_cpf: client.cpf,
        phone, status, message_body: message,
        error_message: status === "failed" ? JSON.stringify(sendResult.result) : null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        metadata: { source_type: "legacy", provider: sendResult.provider, provider_message_id: sendResult.providerMessageId, instance_name: inst?.instance_name },
      });

      if (status === "sent") {
        sent++;
        await ensureConversationAndMessage(supabase, tenantUser.tenant_id, inst?.id || null, phone, client.nome_completo, client.id, message, sendResult.providerMessageId, sendResult.provider);
      } else { failed++; errors.push(`${client.nome_completo}: envio falhou`); }

      // Apply anti-ban delay
      const delay = randomDelay(throttle);
      console.log(`[Legacy Anti-Ban] Waiting ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    } catch (err: any) {
      await logMessage(supabase, {
        tenant_id: tenantUser.tenant_id, client_id: client.id, client_cpf: client.cpf,
        phone, status: "failed", message_body: message, error_message: err.message,
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
