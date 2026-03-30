import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const userId = claimsData.claims.sub;

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

    // ===== NEW CAMPAIGN-BASED FLOW =====
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

// ===== Campaign-based flow =====
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

  // Load all assigned instances
  const instanceIds = [...new Set((recipients || []).map((r: any) => r.assigned_instance_id).filter(Boolean))];
  const { data: instances } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_url, api_key, instance_name, provider")
    .in("id", instanceIds);

  const instanceMap = new Map<string, any>();
  for (const inst of instances || []) {
    instanceMap.set(inst.id, inst);
  }

  // Global Evolution API fallback
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "") || "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Wrap entire processing in try/catch to guarantee campaign always gets a final status
  try {
    for (const recipient of recipients || []) {
      const inst = instanceMap.get(recipient.assigned_instance_id);
      if (!inst) {
        await supabase
          .from("whatsapp_campaign_recipients")
          .update({ status: "failed", error_message: "Instância não encontrada", updated_at: new Date().toISOString() })
          .eq("id", recipient.id);
        failed++;
        errors.push(`${recipient.recipient_name}: instância não encontrada`);
        continue;
      }

      // Load client data for template resolution and traceability
      const { data: client } = await supabase
        .from("clients")
        .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor, phone")
        .eq("id", recipient.representative_client_id)
        .single();

      // Resolve template variables
      let message = recipient.message_body_snapshot || campaign.message_body || "";
      if (client) {
        message = message
          .replace(/\{\{nome\}\}/g, client.nome_completo || "")
          .replace(/\{\{cpf\}\}/g, client.cpf || "")
          .replace(/\{\{valor_parcela\}\}/g,
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(client.valor_parcela || 0)
          )
          .replace(/\{\{data_vencimento\}\}/g,
            client.data_vencimento
              ? new Date(client.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")
              : ""
          )
          .replace(/\{\{credor\}\}/g, client.credor || "");
      }

      const instanceUrl = inst.instance_url || evolutionUrl;
      const instanceKey = inst.api_key || evolutionKey;

      try {
        const resp = await fetch(`${instanceUrl}/message/sendText/${inst.instance_name}`, {
          method: "POST",
          headers: {
            apikey: instanceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ number: recipient.phone, text: message }),
        });

        const result = await resp.json();
        const status = resp.ok ? "sent" : "failed";
        const providerMessageId = result?.key?.id || result?.messageId || null;

        await supabase
          .from("whatsapp_campaign_recipients")
          .update({
            status,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            error_message: status === "failed" ? JSON.stringify(result) : null,
            provider_message_id: providerMessageId,
            message_body_snapshot: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        // Log to message_logs with traceability metadata
        await supabase.from("message_logs").insert({
          tenant_id: tenantId,
          client_id: recipient.representative_client_id,
          client_cpf: client?.cpf || null,
          channel: "whatsapp",
          status,
          phone: recipient.phone,
          message_body: message,
          error_message: status === "failed" ? JSON.stringify(result) : null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
          metadata: {
            campaign_id: campaignId,
            instance_id: recipient.assigned_instance_id,
            instance_name: inst.instance_name,
            provider_message_id: providerMessageId,
          },
        });

        if (status === "sent") sent++;
        else {
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

        await supabase.from("message_logs").insert({
          tenant_id: tenantId,
          client_id: recipient.representative_client_id,
          client_cpf: client?.cpf || null,
          channel: "whatsapp",
          status: "failed",
          phone: recipient.phone,
          message_body: message,
          error_message: err.message,
          metadata: {
            campaign_id: campaignId,
            instance_id: recipient.assigned_instance_id,
            instance_name: inst.instance_name,
          },
        });

        failed++;
        errors.push(`${recipient.recipient_name}: ${err.message}`);
      }

      // Throttle: 200ms between messages
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (globalErr: any) {
    // If the loop itself throws unexpectedly, mark remaining as context error
    console.error("Campaign processing global error:", globalErr);
    errors.push(`Erro global no processamento: ${globalErr.message}`);
  }

  // Determine intelligent final status
  let finalStatus = "completed";
  if (sent === 0 && failed > 0) finalStatus = "failed";
  else if (sent > 0 && failed > 0) finalStatus = "completed_with_errors";
  // If sent === 0 && failed === 0, campaign had no recipients — still "completed"

  // Update campaign with final counters
  // NOTE: delivered_count and read_count remain at 0 — they depend on
  // future webhook-based delivery/read tracking (Phase 2)
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

// ===== Legacy flow (backward compatible) =====
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

  let baylersInstance: { instance_url: string; api_key: string; instance_name: string } | null = null;
  if (provider === "baylers") {
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("instance_url, api_key, instance_name")
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("is_default", true)
      .eq("status", "active")
      .limit(1)
      .single();

    if (instances) {
      const inst = instances as any;
      baylersInstance = {
        instance_url: inst.instance_url || evolutionUrl,
        api_key: inst.api_key || evolutionKey,
        instance_name: inst.instance_name,
      };
    } else if (settings.baylers_api_key && settings.baylers_instance_url) {
      baylersInstance = {
        instance_url: settings.baylers_instance_url,
        api_key: settings.baylers_api_key,
        instance_name: settings.baylers_instance_name || "default",
      };
    }
  }

  if (provider === "gupshup" && (!settings.gupshup_api_key || !settings.gupshup_source_number)) {
    return new Response(JSON.stringify({ error: "Gupshup credentials not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (provider === "baylers" && !baylersInstance) {
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
    const message = message_template
      .replace(/\{\{nome\}\}/g, client.nome_completo)
      .replace(/\{\{cpf\}\}/g, client.cpf)
      .replace(/\{\{valor_parcela\}\}/g,
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(client.valor_parcela)
      )
      .replace(/\{\{data_vencimento\}\}/g,
        new Date(client.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")
      )
      .replace(/\{\{credor\}\}/g, client.credor);

    if (!client.phone) {
      await supabase.from("message_logs").insert({
        tenant_id: tenantUser.tenant_id, client_id: client.id,
        channel: "whatsapp", status: "failed", message_body: message, error_message: "Cliente sem telefone",
      });
      failed++;
      errors.push(`${client.nome_completo}: sem telefone`);
      continue;
    }

    const phone = client.phone.replace(/\D/g, "");

    try {
      let resp: Response;
      let result: any;

      if (provider === "baylers" && baylersInstance) {
        resp = await fetch(`${baylersInstance.instance_url}/message/sendText/${baylersInstance.instance_name}`, {
          method: "POST",
          headers: { apikey: baylersInstance.api_key, "Content-Type": "application/json" },
          body: JSON.stringify({ number: phone, text: message }),
        });
        result = await resp.json();
      } else {
        const formBody = new URLSearchParams({
          channel: "whatsapp", source: settings.gupshup_source_number,
          destination: phone, "src.name": settings.gupshup_app_name || "",
          message: JSON.stringify({ type: "text", text: message }),
        });
        resp = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
          method: "POST",
          headers: { apikey: settings.gupshup_api_key, "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody.toString(),
        });
        result = await resp.json();
      }
      const status = resp.ok ? "sent" : "failed";

      await supabase.from("message_logs").insert({
        tenant_id: tenantUser.tenant_id, client_id: client.id,
        channel: "whatsapp", status, phone, message_body: message,
        error_message: status === "failed" ? JSON.stringify(result) : null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
      });

      if (status === "sent") sent++;
      else { failed++; errors.push(`${client.nome_completo}: envio falhou`); }

      await new Promise((r) => setTimeout(r, 100));
    } catch (err: any) {
      await supabase.from("message_logs").insert({
        tenant_id: tenantUser.tenant_id, client_id: client.id,
        channel: "whatsapp", status: "failed", phone, message_body: message, error_message: err.message,
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