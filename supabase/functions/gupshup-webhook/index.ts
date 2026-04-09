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

  const writeLog = async (tenantId: string | null, eventType: string, message: string, payload?: any, statusCode?: number) => {
    try {
      await (supabase.from("webhook_logs") as any).insert({
        tenant_id: tenantId,
        function_name: "gupshup-webhook",
        event_type: eventType,
        message,
        payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
        status_code: statusCode,
      });
    } catch (e: any) {
      console.error("Failed to write webhook log:", e.message);
    }
  };

  // ========== MEDIA PERSISTENCE ==========
  async function downloadAndUploadMedia(
    mediaUrl: string,
    tenantId: string,
    conversationId: string,
    mediaType: string,
  ): Promise<{ storedUrl: string; mimeType: string } | null> {
    if (!mediaUrl) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const resp = await fetch(mediaUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!resp.ok) {
        console.error(`Media download failed: ${resp.status} from ${mediaUrl}`);
        return null;
      }

      const contentType = resp.headers.get("content-type") || "application/octet-stream";
      const blob = await resp.blob();
      const ext = getExtFromMime(contentType, mediaType);
      const fileName = `${tenantId}/${conversationId}/${crypto.randomUUID()}${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("chat-media")
        .upload(fileName, blob, { contentType, upsert: false });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr.message);
        return null;
      }

      const { data: publicData } = supabase.storage.from("chat-media").getPublicUrl(fileName);
      return { storedUrl: publicData.publicUrl, mimeType: contentType };
    } catch (e: any) {
      console.error("downloadAndUploadMedia error:", e.message);
      return null;
    }
  }

  function getExtFromMime(mime: string, fallbackType: string): string {
    const map: Record<string, string> = {
      "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
      "audio/ogg": ".ogg", "audio/mpeg": ".mp3", "audio/mp4": ".m4a",
      "video/mp4": ".mp4", "application/pdf": ".pdf",
    };
    if (map[mime]) return map[mime];
    const typeMap: Record<string, string> = { image: ".jpg", audio: ".ogg", video: ".mp4", document: ".bin" };
    return typeMap[fallbackType] || ".bin";
  }

  // ========== MEDIA URL CASCADE (ThothAI pattern) ==========
  function extractMediaUrl(msgPayload: any): string {
    return (
      msgPayload?.payload?.url ||
      msgPayload?.payload?.originalUrl ||
      msgPayload?.payload?.payload?.url ||
      msgPayload?.url ||
      msgPayload?.originalUrl ||
      ""
    );
  }

  try {
    const payload = await req.json();
    console.log("Gupshup webhook payload (full):", JSON.stringify(payload));
    
    await writeLog(null, "inbound", `Webhook recebido: type=${payload.type || payload.eventType}`, payload, 200);

    const eventType = payload.type || payload.eventType || (payload.payload?.type === "text" ? "message" : null);

    // ===== Inbound message =====
    if (eventType === "message") {
      const msgPayload = payload.payload || {};
      
      const phone = msgPayload.source || msgPayload.sender?.phone || payload.sender?.phone;
      const senderName = msgPayload.sender?.name || payload.sender?.name || phone || "";
      const msgType = msgPayload.type || "text";
      const content = msgPayload.payload?.text || msgPayload.payload?.caption || payload.payload?.text || "";
      const mediaUrl = extractMediaUrl(msgPayload);
      const externalId = msgPayload.id || payload.messageId || payload.payload?.id || "";
      const destination = msgPayload.destination || payload.destination || "";

      console.log(`Processing GupShup inbound: from=${phone}, to=${destination}, type=${msgType}, externalId=${externalId}`);

      if (phone) {
        let targetTenantId: string | null = null;
        let targetInstanceName: string | null = null;

        // Resolve tenant by source number in settings
        const { data: tenants } = await supabase
          .from("tenants")
          .select("id, settings")
          .not("settings->gupshup_source_number", "is", null);

        for (const t of tenants || []) {
          const s = t.settings as any;
          const cleanSource = s.gupshup_source_number?.replace(/\D/g, "");
          const cleanDest = destination.replace(/\D/g, "");
          if (cleanSource && cleanDest && cleanDest.endsWith(cleanSource)) {
            targetTenantId = t.id;
            console.log(`Matched tenant ${t.id} via source number: ${cleanSource}`);
            break;
          }
        }

        // Fallback: whatsapp_instances
        if (!targetTenantId) {
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("instance_name, tenant_id")
            .eq("provider", "gupshup")
            .limit(1)
            .maybeSingle();
          if (instance) {
            targetTenantId = instance.tenant_id;
            targetInstanceName = instance.instance_name;
            console.log(`Matched tenant ${targetTenantId} via whatsapp_instances fallback`);
          }
        }

        if (targetTenantId) {
          const canonicalType = ["text", "image", "audio", "video", "document"].includes(msgType) ? msgType : "text";

          // Persist media if present
          let finalMediaUrl = mediaUrl;
          let finalMimeType: string | null = null;

          if (mediaUrl && canonicalType !== "text") {
            // We need a conversation_id for storage path — use a temp placeholder, will be resolved after ingest
            const mediaResult = await downloadAndUploadMedia(mediaUrl, targetTenantId, "pending", canonicalType);
            if (mediaResult) {
              finalMediaUrl = mediaResult.storedUrl;
              finalMimeType = mediaResult.mimeType;
            }
          }

          // Build metadata for simulated buttons
          let metadata: Record<string, any> = {};

          // Check for simulated button response (numeric replies like "1", "2", "3")
          if (canonicalType === "text" && /^\d{1,2}$/.test(content.trim())) {
            try {
              // Find the last outbound message with buttons metadata in this phone's conversations
              const { data: recentOutbound } = await supabase
                .from("chat_messages")
                .select("metadata, conversation_id")
                .eq("tenant_id", targetTenantId)
                .eq("direction", "outbound")
                .not("metadata->buttons", "is", null)
                .order("created_at", { ascending: false })
                .limit(5);

              if (recentOutbound && recentOutbound.length > 0) {
                const buttonMsg = recentOutbound[0];
                const buttons = (buttonMsg.metadata as any)?.buttons;
                if (Array.isArray(buttons)) {
                  const idx = parseInt(content.trim()) - 1;
                  if (idx >= 0 && idx < buttons.length) {
                    metadata.simulated_button = {
                      original_text: content.trim(),
                      selected_label: buttons[idx]?.label || buttons[idx],
                      button_index: idx,
                    };
                  }
                }
              }
            } catch (e: any) {
              console.error("Button simulation lookup error:", e.message);
            }
          }

          const { data: result, error: rpcErr } = await supabase.rpc(
            targetInstanceName ? "ingest_channel_event_v2" : "ingest_channel_event",
            {
              ...(targetInstanceName ? { _instance_name: targetInstanceName } : { _tenant_id: targetTenantId }),
              _channel_type: "whatsapp",
              _provider: "gupshup",
              _remote_phone: phone,
              _remote_name: senderName,
              _direction: "inbound",
              _message_type: canonicalType,
              _content: content || null,
              _media_url: finalMediaUrl || null,
              _media_mime_type: finalMimeType,
              _external_id: externalId || null,
              _provider_message_id: externalId || null,
              _actor_type: "human",
              _status: "delivered",
            }
          );

          if (rpcErr) {
            console.error("Ingest error:", rpcErr);
            await writeLog(targetTenantId, "error", `Erro ao ingerir mensagem: ${rpcErr.message}`, { phone, externalId }, 500);
          } else {
            console.log("Gupshup inbound ingested:", JSON.stringify(result));
            await writeLog(targetTenantId, "success", `Mensagem ingerida: from=${phone}, type=${msgType}`, result, 200);

            // Update metadata on the inserted message if we have button context
            if (Object.keys(metadata).length > 0 && result?.message_id) {
              await supabase
                .from("chat_messages")
                .update({ metadata })
                .eq("id", result.message_id);
            }
          }
        } else {
          console.warn("Could not resolve tenant for destination:", destination);
          await writeLog(null, "warning", `Tenant não encontrado para destino: ${destination}`, { phone, destination }, 404);
        }
      }
    }
    // ===== Status update (delivered, read, failed) =====
    else if (eventType === "message-event" || eventType === "status") {
      const status = payload.payload?.type || payload.status;
      const gsMessageId = payload.payload?.gsId || payload.payload?.id || payload.messageId;

      if (gsMessageId && status) {
        const mappedStatus =
          status === "delivered" ? "delivered" :
          status === "read" ? "read" :
          status === "failed" || status === "error" ? "failed" :
          status === "sent" ? "sent" : status;

        await Promise.all([
          supabase.from("chat_messages").update({ status: mappedStatus }).eq("external_id", gsMessageId),
          supabase.from("chat_messages").update({ status: mappedStatus }).eq("provider_message_id", gsMessageId),
        ]);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("gupshup-webhook error:", err);
    await writeLog(null, "error", `Erro geral: ${err.message}`, null, 500);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
