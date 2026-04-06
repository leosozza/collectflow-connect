import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendByProvider } from "../_shared/whatsapp-sender.ts";
import { resolveTemplate } from "../_shared/template-resolver.ts";
import { logMessage } from "../_shared/message-logger.ts";

// ===== Helper: persist conversation + outbound message in CRM =====
async function ensureConversationAndMessage(
  supabase: any,
  tenantId: string,
  instanceId: string | null,
  normalizedPhone: string,
  recipientName: string,
  clientId: string | null,
  messageBody: string,
  providerMessageId: string | null,
) {
  try {
    // Normalize phone for remote_phone (strip 55 prefix for display, keep full)
    const remotePhone = normalizedPhone.replace(/\D/g, "");

    // Try to find existing conversation
    let query = supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("remote_phone", remotePhone);

    if (instanceId) {
      query = query.eq("instance_id", instanceId);
    }

    const { data: existing } = await query.limit(1).maybeSingle();

    let conversationId: string;
    const now = new Date().toISOString();

    if (existing) {
      conversationId = existing.id;
      // Update last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: now, updated_at: now })
        .eq("id", conversationId);
    } else {
      // Create new conversation
      const insertData: any = {
        tenant_id: tenantId,
        remote_phone: remotePhone,
        remote_name: recipientName || remotePhone,
        status: "open",
        last_message_at: now,
        unread_count: 0,
      };
      if (instanceId) insertData.instance_id = instanceId;
      if (clientId) insertData.client_id = clientId;

      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert(insertData)
        .select("id")
        .single();

      if (convErr) {
        console.error("Error creating conversation:", convErr);
        return;
      }
      conversationId = newConv.id;
    }

    // Insert outbound message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: "outbound",
      content: messageBody,
      message_type: "text",
      status: "sent",
      external_id: providerMessageId || null,
      is_internal: false,
    });
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

    if (!["admin", "super_admin"].includes(tenantUser.role)) {
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

    // ===== LEGACY FLOW (preserved for backward compatibility) =====
    return await handleLegacyFlow(supabase, body, tenantUser);
  } catch (err: any) {
    console.error("send-bulk-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== Campaign-based flow (Fases 1-4: shared helpers + batch load) =====
async function handleCampaignFlow(supabase: any, campaignId: string, tenantId: string) {
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

  // Load tenant settings for Gupshup credentials
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .single();
  const tenantSettings = (tenantData?.settings || {}) as Record<string, any>;

  // Update campaign status to sending
  await supabase
    .from("whatsapp_campaigns")
    .update({ status: "sending", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  // Load ONLY pending recipients
  const { data: recipients, error: rErr } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (rErr) throw rErr;

  // Load all assigned instances from DB
  const instanceIds = [...new Set((recipients || []).map((r: any) => r.assigned_instance_id).filter(Boolean))];
  const { data: instances } = instanceIds.length > 0
    ? await supabase
        .from("whatsapp_instances")
        .select("id, instance_url, api_key, instance_name, provider")
        .in("id", instanceIds)
    : { data: [] };

  const instanceMap = new Map<string, any>();
  for (const inst of instances || []) {
    instanceMap.set(inst.id, inst);
  }

  // Build virtual Gupshup instance for recipients with null assigned_instance_id
  const hasGupshupRecipients = (recipients || []).some((r: any) => !r.assigned_instance_id);
  const gupshupConfigured = !!(tenantSettings.gupshup_api_key && tenantSettings.gupshup_source_number);
  const useGupshupFallback = hasGupshupRecipients && gupshupConfigured;

  // Pre-flight: validate all instances have credentials
  const missingInstances: string[] = [];
  for (const iid of instanceIds) {
    if (!instanceMap.has(iid)) {
      missingInstances.push(iid);
    }
  }
  if (hasGupshupRecipients && !gupshupConfigured) {
    missingInstances.push("gupshup-official (credenciais não configuradas)");
  }

  if (missingInstances.length > 0 && missingInstances.length === instanceIds.length + (hasGupshupRecipients ? 1 : 0)) {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "failed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    return new Response(
      JSON.stringify({ error: `Instâncias não encontradas: ${missingInstances.join(", ")}`, sent: 0, failed: (recipients || []).length, errors: [`Nenhuma instância válida encontrada`], finalStatus: "failed" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Global fallback env vars
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "") || "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
  const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

  // Fase 4: Batch load de clientes — elimina N+1 query
  const clientIds = [...new Set((recipients || []).map((r: any) => r.representative_client_id).filter(Boolean))];
  const clientMap = new Map<string, any>();
  if (clientIds.length > 0) {
    // Batch in chunks of 500 to avoid query limits
    for (let i = 0; i < clientIds.length; i += 500) {
      const chunk = clientIds.slice(i, i + 500);
      const { data: clients } = await supabase
        .from("clients")
        .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor, phone")
        .in("id", chunk);
      for (const c of clients || []) {
        clientMap.set(c.id, c);
      }
    }
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    for (const recipient of recipients || []) {
      // Resolve instance: DB instance or virtual Gupshup
      let inst = instanceMap.get(recipient.assigned_instance_id);

      if (!inst && !recipient.assigned_instance_id && useGupshupFallback) {
        inst = { provider: "gupshup", instance_name: tenantSettings.gupshup_app_name || "gupshup" };
      }

      if (!inst) {
        await supabase
          .from("whatsapp_campaign_recipients")
          .update({ status: "failed", error_message: "Instância não encontrada", updated_at: new Date().toISOString() })
          .eq("id", recipient.id);
        failed++;
        errors.push(`${recipient.recipient_name}: instância não encontrada`);
        continue;
      }

      // Fase 4: usar clientMap em vez de query individual
      const client = clientMap.get(recipient.representative_client_id) || null;

      // Fase 2: resolvedor unificado de templates
      const rawMessage = recipient.message_body_snapshot || campaign.message_body || "";
      const message = client ? resolveTemplate(rawMessage, client) : rawMessage;

      try {
        // Fase 1: motor unificado de envio
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

        // Fase 3: logger unificado com metadata de rastreabilidade
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
          sent++;
          // Persist conversation + outbound message in CRM
          await ensureConversationAndMessage(
            supabase, tenantId, recipient.assigned_instance_id,
            recipient.phone, recipient.recipient_name,
            recipient.representative_client_id, message,
            sendResult.providerMessageId
          );
        } else {
          failed++;
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

        // Fase 3: logger unificado para erros
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

        failed++;
        errors.push(`${recipient.recipient_name}: ${err.message}`);
      }

      // Throttle: 200ms between messages
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (globalErr: any) {
    console.error("Campaign processing global error:", globalErr);
    errors.push(`Erro global no processamento: ${globalErr.message}`);
  }

  // Determine intelligent final status
  let finalStatus = "completed";
  if (sent === 0 && failed > 0) finalStatus = "failed";
  else if (sent > 0 && failed > 0) finalStatus = "completed_with_errors";

  // Update campaign with final counters
  await supabase
    .from("whatsapp_campaigns")
    .update({
      status: finalStatus,
      sent_count: sent,
      failed_count: failed,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return new Response(
    JSON.stringify({ success: true, sent, failed, total: (recipients || []).length, errors, finalStatus }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ===== Legacy flow (backward compatible — Fases 1-3: shared helpers) =====
async function handleLegacyFlow(supabase: any, body: any, tenantUser: any) {
  const { client_ids, message_template } = body;

  if (!client_ids?.length || !message_template) {
    return new Response(JSON.stringify({ error: "client_ids and message_template required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get tenant settings
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
    // Fase 2: resolvedor unificado de templates
    const message = resolveTemplate(message_template, client);

    if (!client.phone) {
      // Fase 3: logger unificado
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
      // Fase 1: motor unificado de envio
      const sendResult = await sendByProvider(
        inst!, phone, message, settings,
        evolutionUrl, evolutionKey, wuzapiUrl, wuzapiAdminToken
      );

      const status = sendResult.ok ? "sent" : "failed";

      // Fase 3: logger unificado
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

      if (status === "sent") sent++;
      else { failed++; errors.push(`${client.nome_completo}: envio falhou`); }

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
