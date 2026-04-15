import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadAndUploadMedia, getExtFromMime } from "../_shared/media-persistence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("[provider=unofficial] Webhook received:", JSON.stringify(body).slice(0, 500));

    const event = body.event;
    const instanceName = body.instance;

    if (!instanceName) {
      return new Response(JSON.stringify({ ok: true, skipped: "no instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Handle connection state changes =====
    if (event === "connection.update") {
      const state = body.data?.state;
      const sender = body.sender;
      console.log("connection.update:", instanceName, "state:", state, "sender:", sender);

      const statusValue = state === "open" ? "connected" : state === "close" ? "disconnected" : state;
      const updateData: Record<string, any> = { status: statusValue };

      if (state === "open" && sender) {
        updateData.phone_number = sender.replace("@s.whatsapp.net", "");
      }

      await supabase
        .from("whatsapp_instances")
        .update(updateData)
        .eq("instance_name", instanceName);

      return new Response(JSON.stringify({ ok: true, state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Handle message events =====
    if (event === "messages.upsert") {
      const msgData = body.data;
      if (!msgData) {
        return new Response(JSON.stringify({ ok: true, skipped: "no data" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const remoteJid = msgData.key?.remoteJid || "";
      const remotePhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const fromMe = msgData.key?.fromMe || false;
      const externalId = msgData.key?.id || "";
      const pushName = msgData.pushName || "";

      // Parse message content — explicit per type
      let messageType = "text";
      let content = "";
      let rawMediaUrl = "";
      let mediaMimeType = "";

      const msg = msgData.message;
      if (msg?.conversation) {
        content = msg.conversation;
      } else if (msg?.extendedTextMessage?.text) {
        content = msg.extendedTextMessage.text;
      } else if (msg?.imageMessage) {
        messageType = "image";
        content = msg.imageMessage.caption || "";
        mediaMimeType = msg.imageMessage.mimetype || "image/jpeg";
        rawMediaUrl = msgData.mediaUrl || "";
      } else if (msg?.audioMessage) {
        messageType = "audio";
        mediaMimeType = msg.audioMessage.mimetype || "audio/ogg";
        rawMediaUrl = msgData.mediaUrl || "";
      } else if (msg?.videoMessage) {
        messageType = "video";
        content = msg.videoMessage.caption || "";
        mediaMimeType = msg.videoMessage.mimetype || "video/mp4";
        rawMediaUrl = msgData.mediaUrl || "";
      } else if (msg?.documentMessage) {
        messageType = "document";
        content = msg.documentMessage.fileName || "";
        mediaMimeType = msg.documentMessage.mimetype || "application/octet-stream";
        rawMediaUrl = msgData.mediaUrl || "";
      } else if (msg?.stickerMessage) {
        messageType = "sticker";
        rawMediaUrl = msgData.mediaUrl || "";
      }

      console.log(`[provider=unofficial] Parsed: type=${messageType}, mime=${mediaMimeType}, hasMedia=${!!rawMediaUrl}, fromMe=${fromMe}`);

      // ===== Persist media to Storage =====
      let finalMediaUrl = rawMediaUrl;
      let finalMimeType = mediaMimeType;

      // Lookup instance (needed for tenant_id and Evolution API credentials)
      const { data: instRow } = await supabase
        .from("whatsapp_instances")
        .select("tenant_id, instance_url, api_key")
        .eq("instance_name", instanceName)
        .maybeSingle();

      const tenantId = instRow?.tenant_id || "unknown";

      // Resolve Evolution API credentials: DB first, webhook payload as fallback
      const evoUrl = instRow?.instance_url || body.server_url || "";
      const evoKey = instRow?.api_key || body.apikey || "";

      // Persist credentials to DB if missing (for future calls)
      if (evoUrl && evoKey && instRow && (!instRow.instance_url || !instRow.api_key)) {
        supabase
          .from("whatsapp_instances")
          .update({ instance_url: evoUrl, api_key: evoKey })
          .eq("instance_name", instanceName)
          .then(() => console.log("[provider=unofficial] Persisted Evolution credentials from webhook payload"))
          .catch((e: any) => console.warn("[provider=unofficial] Failed to persist credentials:", e.message));
      }

      // If no direct media URL but message has media, fetch via Evolution getBase64 API
      if (!rawMediaUrl && messageType !== "text" && evoUrl && evoKey) {
        try {
          console.log(`[provider=unofficial] No mediaUrl, fetching via Evolution getBase64 for ${messageType} (url=${evoUrl.substring(0, 40)})`);
          const b64Controller = new AbortController();
          const b64Timeout = setTimeout(() => b64Controller.abort(), 25000);

          const b64Resp = await fetch(
            `${evoUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: evoKey },
              body: JSON.stringify({ message: { key: msgData.key } }),
              signal: b64Controller.signal,
            }
          );
          clearTimeout(b64Timeout);

          if (b64Resp.ok) {
            const b64Data = await b64Resp.json();
            const b64String = b64Data?.base64 || "";
            
            if (b64String) {
              // base64 may come as "data:audio/ogg;base64,XXXX" or plain base64
              let actualBase64 = b64String;
              let detectedMime = mediaMimeType;
              
              if (b64String.startsWith("data:")) {
                const dataUrlMatch = b64String.match(/^data:([^;]+);base64,(.+)$/);
                if (dataUrlMatch) {
                  detectedMime = dataUrlMatch[1];
                  actualBase64 = dataUrlMatch[2];
                }
              }

              // Decode base64 to binary
              const binaryString = atob(actualBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              if (bytes.length > 0) {
                const ext = getExtFromMime(detectedMime || mediaMimeType, messageType);
                const fileName = `${tenantId}/inbound/${crypto.randomUUID()}${ext}`;
                const contentType = detectedMime || mediaMimeType || "application/octet-stream";

                console.log(`[provider=unofficial] Uploading base64 media: ${fileName} (${bytes.length} bytes, ${contentType})`);

                const { error: uploadErr } = await supabase.storage
                  .from("chat-media")
                  .upload(fileName, bytes, { contentType, upsert: false });

                if (!uploadErr) {
                  const { data: publicData } = supabase.storage.from("chat-media").getPublicUrl(fileName);
                  finalMediaUrl = publicData.publicUrl;
                  finalMimeType = contentType;
                  console.log(`[provider=unofficial] Base64 media persisted: ${finalMediaUrl.substring(0, 80)}`);
                } else {
                  console.error("[provider=unofficial] Storage upload from base64 failed:", uploadErr.message);
                }
              }
            } else {
              console.warn("[provider=unofficial] Evolution getBase64 returned empty base64");
            }
          } else {
            console.error(`[provider=unofficial] Evolution getBase64 HTTP ${b64Resp.status}`);
          }
        } catch (e: any) {
          if (e.name === "AbortError") {
            console.error("[provider=unofficial] Evolution getBase64 timed out after 25s");
          } else {
            console.error("[provider=unofficial] Evolution getBase64 error:", e.message);
          }
        }
      }

      // If we have a direct URL (from webhook or other provider), download and persist
      if (rawMediaUrl && messageType !== "text") {
        const mediaResult = await downloadAndUploadMedia(
          supabase,
          rawMediaUrl,
          tenantId,
          "inbound",
          messageType,
          mediaMimeType,
        );

        if (mediaResult) {
          finalMediaUrl = mediaResult.storedUrl;
          finalMimeType = mediaMimeType || mediaResult.mimeType;
          console.log(`[provider=unofficial] Media persisted: ${finalMediaUrl.substring(0, 80)}`);
        } else {
          console.warn("[provider=unofficial] Media persistence failed, using raw URL as fallback");
        }
      }

      // Single RPC call
      const { data: result, error: rpcErr } = await supabase.rpc("ingest_channel_event_v2", {
        _instance_name: instanceName,
        _channel_type: "whatsapp",
        _remote_phone: remotePhone,
        _remote_name: pushName || remotePhone,
        _direction: fromMe ? "outbound" : "inbound",
        _message_type: messageType,
        _content: content || null,
        _media_url: finalMediaUrl || null,
        _media_mime_type: finalMimeType || null,
        _external_id: externalId || null,
        _provider_message_id: null,
        _actor_type: "human",
        _status: fromMe ? "sent" : "delivered",
      });

      if (rpcErr) {
        console.error("[provider=unofficial] ingest_channel_event_v2 error:", rpcErr);
        throw rpcErr;
      }

      console.log("[provider=unofficial] Ingested:", JSON.stringify(result));

      // ===== Trigger async transcription for audio (inbound + outbound) =====
      if (messageType === "audio" && finalMediaUrl && result?.message_id) {
        try {
          console.log(`[provider=unofficial] Triggering transcription for message ${result.message_id} (${fromMe ? 'outbound' : 'inbound'})`);
          fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messageId: result.message_id,
              audioUrl: finalMediaUrl,
            }),
          }).catch((e) => console.error("[provider=unofficial] Transcription trigger failed:", e.message));
        } catch (e: any) {
          console.error("[provider=unofficial] Transcription trigger error:", e.message);
        }
      }

      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Handle message status updates =====
    if (event === "messages.update") {
      const updates = Array.isArray(body.data) ? body.data : [body.data];
      for (const update of updates) {
        const externalId = update?.key?.id;
        const statusMap: Record<number, string> = {
          2: "sent",
          3: "delivered",
          4: "read",
          5: "read",
        };
        const newStatus = statusMap[update?.status] || null;
        if (externalId && newStatus) {
          await supabase
            .from("chat_messages")
            .update({ status: newStatus })
            .eq("external_id", externalId);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[provider=unofficial] whatsapp-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
