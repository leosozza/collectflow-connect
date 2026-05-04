import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadAndUploadMedia } from "../_shared/media-persistence.ts";

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

  // ========== Extract filename from Gupshup payload ==========
  function extractFilename(msgPayload: any): string {
    return (
      msgPayload?.payload?.name ||
      msgPayload?.payload?.filename ||
      msgPayload?.payload?.payload?.name ||
      ""
    );
  }

  // ========== Extract MIME from Gupshup payload ==========
  function extractMimeType(msgPayload: any, canonicalType: string): string {
    const ct = msgPayload?.payload?.contentType || msgPayload?.payload?.mime_type || "";
    if (ct) return ct;
    // Fallback defaults per type
    const defaults: Record<string, string> = {
      image: "image/jpeg",
      audio: "audio/ogg",
      video: "video/mp4",
      document: "application/octet-stream",
    };
    return defaults[canonicalType] || "";
  }

  function buildQuotedPreview(replyToExternalId: string | null, msgPayload: any, payload: any): Record<string, any> | null {
    if (!replyToExternalId) return null;
    const context =
      msgPayload.context ||
      msgPayload.payload?.context ||
      payload.context ||
      payload.payload?.context ||
      {};
    const contextPayload = context.payload || context.message || {};
    const text =
      contextPayload.text ||
      context.text ||
      contextPayload.caption ||
      "";
    const rawType = contextPayload.type || context.type || "text";
    const messageType = rawType === "file" ? "document" : rawType;
    return {
      external_id: replyToExternalId,
      provider_message_id: context.gsId || context.id || replyToExternalId,
      message_type: ["text", "image", "audio", "video", "document"].includes(messageType) ? messageType : "text",
      content: text ? String(text).slice(0, 500) : "[mensagem respondida]",
    };
  }

  try {
    const payload = await req.json();
    console.log("[provider=gupshup] Webhook payload:", JSON.stringify(payload).slice(0, 500));

    await writeLog(null, "inbound", `Webhook recebido: type=${payload.type || payload.eventType}`, payload, 200);

    const eventType = payload.type || payload.eventType || (payload.payload?.type === "text" ? "message" : null);

    // ===== Inbound message =====
    if (eventType === "message") {
      const msgPayload = payload.payload || {};

      const phone = msgPayload.source || msgPayload.sender?.phone || payload.sender?.phone;
      const senderName = msgPayload.sender?.name || payload.sender?.name || phone || "";
      const msgType = msgPayload.type || "text";
      const filename = extractFilename(msgPayload);
      const mediaUrl = extractMediaUrl(msgPayload);
      const externalId = msgPayload.id || payload.messageId || payload.payload?.id || "";
      const destination = msgPayload.destination || payload.destination || "";

      // Reply / quoted reference (Gupshup may expose context.id or context.gsId)
      const replyToExternalId: string | null =
        msgPayload.context?.id ||
        msgPayload.context?.gsId ||
        msgPayload.payload?.context?.id ||
        payload.context?.id ||
        null;
      if (replyToExternalId) {
        console.log(`[provider=gupshup] Reply detected, context.id=${replyToExternalId}`);
      }

      // Map Gupshup types to canonical
      const rawType = msgType === "file" ? "document" : msgType;
      const canonicalType = ["text", "image", "audio", "video", "document"].includes(rawType) ? rawType : "text";

      // Content: caption for image/video, filename for document, text for text
      let content = "";
      if (canonicalType === "text") {
        content = msgPayload.payload?.text || payload.payload?.text || "";
      } else if (canonicalType === "image" || canonicalType === "video") {
        content = msgPayload.payload?.caption || "";
      } else if (canonicalType === "document") {
        content = filename || msgPayload.payload?.caption || "";
      }
      // audio: no content field

      const providerMimeType = extractMimeType(msgPayload, canonicalType);

      console.log(`[provider=gupshup] Processing: from=${phone}, to=${destination}, type=${canonicalType}, mime=${providerMimeType}, hasMedia=${!!mediaUrl}, filename=${filename}`);

      if (phone) {
        let targetTenantId: string | null = null;
        let targetEndpointId: string | null = null;

        // Resolve tenant by source number in settings — O(1) direct query
        const cleanDest = destination.replace(/\D/g, "");
        if (cleanDest) {
          const { data: matched } = await supabase
            .from("tenants")
            .select("id")
            .like("settings->>gupshup_source_number", `%${cleanDest.slice(-10)}`)
            .limit(1)
            .maybeSingle();
          if (matched) {
            targetTenantId = matched.id;
            console.log(`[provider=gupshup] Matched tenant ${matched.id} via source number`);
          }
        }

        // Resolve Gupshup instance for endpoint_id
        if (targetTenantId) {
          const { data: gupInst } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_name")
            .eq("tenant_id", targetTenantId)
            .eq("provider", "gupshup")
            .limit(1)
            .maybeSingle();
          if (gupInst) {
            targetEndpointId = gupInst.id;
            console.log(`[provider=gupshup] Resolved endpoint_id=${targetEndpointId}`);
          }
        }

        // Fallback: whatsapp_instances
        if (!targetTenantId) {
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_name, tenant_id")
            .eq("provider", "gupshup")
            .limit(1)
            .maybeSingle();
          if (instance) {
            targetTenantId = instance.tenant_id;
            targetEndpointId = instance.id;
            console.log(`[provider=gupshup] Matched tenant ${targetTenantId} via whatsapp_instances fallback`);
          }
        }

        if (targetTenantId) {
          // Persist media if present
          let finalMediaUrl = mediaUrl;
          let finalMimeType: string | null = providerMimeType || null;

          if (mediaUrl && canonicalType !== "text") {
            const mediaResult = await downloadAndUploadMedia(
              supabase, mediaUrl, targetTenantId, "inbound", canonicalType, providerMimeType,
            );
            if (mediaResult) {
              finalMediaUrl = mediaResult.storedUrl;
              finalMimeType = providerMimeType || mediaResult.mimeType;
              console.log(`[provider=gupshup] Media persisted: ${finalMediaUrl.substring(0, 80)}`);
            } else {
              console.warn("[provider=gupshup] Media persistence failed, using raw URL as fallback");
            }
          }

          // Build metadata for simulated buttons
          let metadata: Record<string, any> = {};
          const quotedPreview = buildQuotedPreview(replyToExternalId, msgPayload, payload);

          if (canonicalType === "text" && /^\d{1,2}$/.test(content.trim())) {
            try {
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
              console.error("[provider=gupshup] Button simulation lookup error:", e.message);
            }
          }

          // Use ingest_channel_event with explicit tenant_id + endpoint_id
          const { data: result, error: rpcErr } = await supabase.rpc("ingest_channel_event", {
            _tenant_id: targetTenantId,
            _endpoint_id: targetEndpointId,
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
            _reply_to_external_id: replyToExternalId,
          });

          if (rpcErr) {
            console.error("[provider=gupshup] Ingest error:", rpcErr);
            await writeLog(targetTenantId, "error", `Erro ao ingerir mensagem: ${rpcErr.message}`, { phone, externalId }, 500);
          } else {
            console.log("[provider=gupshup] Ingested:", JSON.stringify(result));
            await writeLog(targetTenantId, "success", `Mensagem ingerida: from=${phone}, type=${canonicalType}`, result, 200);

            if (result?.message_id) {
              try {
                let replyToMessageId = result?.reply_to_message_id || null;
                if (!replyToMessageId && replyToExternalId && result?.conversation_id) {
                  const [{ data: byExternal }, { data: byProvider }] = await Promise.all([
                    supabase
                      .from("chat_messages")
                      .select("id")
                      .eq("tenant_id", targetTenantId)
                      .eq("conversation_id", result.conversation_id)
                      .eq("external_id", replyToExternalId)
                      .limit(1),
                    supabase
                      .from("chat_messages")
                      .select("id")
                      .eq("tenant_id", targetTenantId)
                      .eq("conversation_id", result.conversation_id)
                      .eq("provider_message_id", replyToExternalId)
                      .limit(1),
                  ]);
                  replyToMessageId = byExternal?.[0]?.id || byProvider?.[0]?.id || null;
                }

                const { data: existingMsg } = await supabase
                  .from("chat_messages")
                  .select("metadata")
                  .eq("id", result.message_id)
                  .maybeSingle();
                const mergedMeta = {
                  ...(((existingMsg as any)?.metadata as Record<string, unknown>) || {}),
                  ...metadata,
                  provider_message_id: externalId || null,
                  ...(replyToExternalId ? { reply_to_external_id: replyToExternalId } : {}),
                  ...(quotedPreview ? { quoted_message: quotedPreview } : {}),
                };
                const updates: Record<string, unknown> = { metadata: mergedMeta };
                if (replyToMessageId) updates.reply_to_message_id = replyToMessageId;
                await supabase.from("chat_messages").update(updates).eq("id", result.message_id);
              } catch (metaErr: any) {
                console.warn("[provider=gupshup] metadata/reply update failed:", metaErr.message);
              }
            }

            // ===== Trigger async transcription for audio =====
            if (canonicalType === "audio" && finalMediaUrl && result?.message_id) {
              try {
                console.log(`[provider=gupshup] Triggering transcription for message ${result.message_id}`);
                fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    messageId: result.message_id,
                    audioUrl: finalMediaUrl,
                  }),
                }).catch((e) => console.error("[provider=gupshup] Transcription trigger failed:", e.message));
              } catch (e: any) {
                console.error("[provider=gupshup] Transcription trigger error:", e.message);
              }
            }
          }
        } else {
          console.warn("[provider=gupshup] Could not resolve tenant for destination:", destination);
          await writeLog(null, "warning", `Tenant não encontrado para destino: ${destination}`, { phone, destination }, 404);
        }
      }
    }
    // ===== Status update (delivered, read, failed) =====
    else if (eventType === "message-event" || eventType === "status") {
      const status = payload.payload?.type || payload.status;
      const gsMessageId = payload.payload?.gsId || payload.payload?.id || payload.messageId;

      // Extract error details for failed messages
      const errorReason = payload.payload?.payload?.reason || payload.payload?.reason || "";
      const errorCode = payload.payload?.payload?.code || payload.payload?.code || "";

      if (gsMessageId && status) {
        if (status === "deleted" || status === "delete") {
          const [{ data: msgByExt }, { data: msgByProv }] = await Promise.all([
            supabase
              .from("chat_messages")
              .select("id, tenant_id, metadata")
              .eq("external_id", gsMessageId)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("chat_messages")
              .select("id, tenant_id, metadata")
              .eq("provider_message_id", gsMessageId)
              .order("created_at", { ascending: false })
              .limit(1),
          ]);
          const matchedMsg = msgByExt?.[0] || msgByProv?.[0];
          if (matchedMsg) {
            const existingMeta = (matchedMsg.metadata || {}) as Record<string, any>;
            await supabase.from("chat_messages").update({
              deleted_for_recipient_at: new Date().toISOString(),
              metadata: {
                ...existingMeta,
                deleted_by_whatsapp: {
                  detected_at: new Date().toISOString(),
                  provider: "gupshup",
                  provider_message_id: gsMessageId,
                  payload: payload.payload || payload,
                },
              },
            }).eq("id", matchedMsg.id);
          }

          await writeLog(null, "message_deleted", `Mensagem marcada como apagada: ${gsMessageId}`, payload, 200);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const mappedStatus =
          status === "delivered" ? "delivered" :
            status === "read" ? "read" :
              status === "failed" || status === "error" ? "failed" :
                status === "sent" ? "sent" : status;

        // For failed status, persist the error reason in metadata
        if (mappedStatus === "failed" && (errorReason || errorCode)) {
          const providerError = errorReason ? `${errorCode ? `[${errorCode}] ` : ""}${errorReason}` : `Código: ${errorCode}`;

          // Update by external_id
          const { data: msgByExt } = await supabase
            .from("chat_messages")
            .select("id, tenant_id, metadata")
            .eq("external_id", gsMessageId)
            .order("created_at", { ascending: false })
            .limit(1);

          const { data: msgByProv } = await supabase
            .from("chat_messages")
            .select("id, tenant_id, metadata")
            .eq("provider_message_id", gsMessageId)
            .order("created_at", { ascending: false })
            .limit(1);

          const matchedMsg = msgByExt?.[0] || msgByProv?.[0];
          if (matchedMsg) {
            const existingMeta = (matchedMsg.metadata || {}) as Record<string, any>;
            await supabase.from("chat_messages").update({
              status: mappedStatus,
              metadata: { ...existingMeta, provider_error: providerError },
            }).eq("id", matchedMsg.id);
          }

          await writeLog(null, "status_failed", `Mensagem falhou: ${providerError}`, { gsMessageId, errorReason, errorCode }, 200);
        } else {
          const [{ data: msgByExt }, { data: msgByProv }] = await Promise.all([
            supabase
              .from("chat_messages")
              .select("id, tenant_id")
              .eq("external_id", gsMessageId)
              .order("created_at", { ascending: false })
              .limit(1),
            supabase
              .from("chat_messages")
              .select("id, tenant_id")
              .eq("provider_message_id", gsMessageId)
              .order("created_at", { ascending: false })
              .limit(1),
          ]);
          const matchedMsg = msgByExt?.[0] || msgByProv?.[0];
          if (matchedMsg) {
            await supabase.from("chat_messages").update({ status: mappedStatus }).eq("id", matchedMsg.id);
          }
        }

        // ===== Propagate to campaign recipient =====
        if (mappedStatus === "delivered" || mappedStatus === "read" || mappedStatus === "failed") {
          const { data: recipient } = await supabase
            .from("whatsapp_campaign_recipients")
            .select("id, campaign_id, status, delivered_at")
            .eq("provider_message_id", gsMessageId)
            .maybeSingle();

          if (recipient) {
            const currentRank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 1 };
            const cur = currentRank[recipient.status as string] ?? 0;

            const patch: Record<string, any> = {};
            if (mappedStatus === "failed" && recipient.status !== "read" && recipient.status !== "delivered") {
              patch.status = "failed";
              if (errorReason || errorCode) {
                patch.error_message = errorReason ? `${errorCode ? `[${errorCode}] ` : ""}${errorReason}` : `Código: ${errorCode}`;
              }
            } else if (mappedStatus === "delivered" && cur < 2) {
              patch.status = "delivered";
              patch.delivered_at = new Date().toISOString();
            } else if (mappedStatus === "read" && cur < 3) {
              patch.status = "read";
              patch.read_at = new Date().toISOString();
              if (!recipient.delivered_at) patch.delivered_at = new Date().toISOString();
            }

            if (Object.keys(patch).length > 0) {
              await supabase.from("whatsapp_campaign_recipients").update(patch).eq("id", recipient.id);
              await supabase.rpc("recompute_campaign_counters", { _campaign_id: recipient.campaign_id });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[provider=gupshup] gupshup-webhook error:", err);
    await writeLog(null, "error", `Erro geral: ${err.message}`, null, 500);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
