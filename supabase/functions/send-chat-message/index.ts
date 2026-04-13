import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendByProvider } from "../_shared/whatsapp-sender.ts";
import type { MediaPayload } from "../_shared/whatsapp-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Auth — validate JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  const userId = claimsData.claims.sub as string;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const {
      conversationId,
      content,
      replyToMessageId,
      // Media fields (optional)
      mediaUrl,
      mediaType,
      mediaMimeType,
      fileName,
    } = body;

    if (!conversationId) {
      return jsonResp({ error: "conversationId é obrigatório" }, 400);
    }

    if (!content && !mediaUrl) {
      return jsonResp({ error: "content ou mediaUrl é obrigatório" }, 400);
    }

    // 2. Resolve tenant
    const { data: tenantRow } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!tenantRow) {
      return jsonResp({ error: "Tenant não encontrado" }, 403);
    }
    const tenantId = tenantRow.tenant_id;

    // 3. Fetch conversation + instance
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, remote_phone, status, instance_id, endpoint_id, provider, channel_type")
      .eq("id", conversationId)
      .eq("tenant_id", tenantId)
      .single();

    if (convErr || !conv) {
      return jsonResp({ error: "Conversa não encontrada" }, 404);
    }

    const instanceId = conv.endpoint_id || conv.instance_id;

    // 4. Fetch WhatsApp instance
    let instance: any = null;
    if (instanceId) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, instance_url, api_key, provider, tenant_id")
        .eq("id", instanceId)
        .eq("tenant_id", tenantId)
        .single();
      instance = inst;
    }

    if (!instance) {
      return jsonResp({ error: "Instância WhatsApp não encontrada para esta conversa" }, 404);
    }

    // 5. Tenant settings
    const { data: tenant } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const tenantSettings = (tenant?.settings as Record<string, any>) || {};

    // 6. Build media payload if applicable
    let media: MediaPayload | null = null;
    if (mediaUrl && mediaType) {
      media = {
        mediaUrl,
        mediaType,
        caption: (mediaType === "audio" ? "" : (content || fileName || "")), // Audio doesn't support caption in WA Official
        fileName: fileName || undefined,
        mimeType: mediaMimeType || undefined,
      };
    }

    // 7. Send via multiprovider
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    const wuzapiUrl = Deno.env.get("WUZAPI_API_URL") || "";
    const wuzapiToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

    const providerName = (instance?.provider || conv.provider || "").toLowerCase();
    
    if (media?.mediaType === "audio") {
      console.log(`[send-chat-message] Outbound Audio: provider=${providerName}, mime=${media.mimeType}, url=${media.mediaUrl}`);
    }

    const sendResult = await sendByProvider(
      {
        provider: instance.provider || conv.provider || "",
        instance_url: instance.instance_url,
        api_key: instance.api_key,
        instance_name: instance.instance_name,
      },
      conv.remote_phone,
      content || "",
      tenantSettings,
      evolutionUrl,
      evolutionKey,
      wuzapiUrl,
      wuzapiToken,
      media,
    );

    if (!sendResult.ok) {
      console.error(`[send-chat-message] Send failed (${providerName}):`, JSON.stringify(sendResult.result));
      return jsonResp({ error: "Erro ao enviar mensagem", details: sendResult.result }, 502);
    }
    
    console.log(`[send-chat-message] Send success (${providerName}): msgId=${sendResult.providerMessageId}`);

    // 8. Determine message_type for RPC
    const msgType = media ? mediaType : "text";

    // 9. Persist via ingest_channel_event RPC
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("ingest_channel_event", {
      _tenant_id: tenantId,
      _endpoint_id: instanceId,
      _channel_type: conv.channel_type || "whatsapp",
      _provider: sendResult.provider || instance.provider || null,
      _remote_phone: conv.remote_phone,
      _remote_name: conv.remote_phone,
      _direction: "outbound",
      _message_type: msgType,
      _content: content || fileName || null,
      _media_url: mediaUrl || null,
      _media_mime_type: mediaMimeType || null,
      _external_id: sendResult.providerMessageId || null,
      _provider_message_id: sendResult.providerMessageId || null,
      _actor_type: "human",
      _status: "sent",
    });

    if (rpcErr) {
      console.error("ingest_channel_event error:", rpcErr);
      return jsonResp({
        error: "Mensagem enviada mas houve erro ao persistir",
        send_ok: true,
        provider_message_id: sendResult.providerMessageId,
      }, 500);
    }

    // 10. Handle reply_to
    if (replyToMessageId && rpcResult?.message_id) {
      await supabase
        .from("chat_messages")
        .update({ reply_to_message_id: replyToMessageId })
        .eq("id", rpcResult.message_id);
    }

    // 11. Waiting → open for outbound
    if (conv.status === "waiting") {
      await supabase
        .from("conversations")
        .update({ status: "open" })
        .eq("id", conversationId);
    }

    return jsonResp({
      success: true,
      conversation_id: rpcResult?.conversation_id || conversationId,
      message_id: rpcResult?.message_id,
      provider: sendResult.provider,
      provider_message_id: sendResult.providerMessageId,
    });
  } catch (err) {
    console.error("send-chat-message error:", err);
    return jsonResp({ error: "Erro interno ao enviar mensagem" }, 500);
  }
});
