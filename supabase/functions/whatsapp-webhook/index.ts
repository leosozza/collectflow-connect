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

      if (rawMediaUrl && messageType !== "text") {
        // Lookup instance to get tenant_id for storage path
        const { data: instRow } = await supabase
          .from("whatsapp_instances")
          .select("tenant_id")
          .eq("instance_name", instanceName)
          .maybeSingle();

        const tenantId = instRow?.tenant_id || "unknown";

        const mediaResult = await downloadAndUploadMedia(
          supabase,
          rawMediaUrl,
          tenantId,
          "inbound",
          messageType,
          mediaMimeType, // pass provider MIME as fallback
        );

        if (mediaResult) {
          finalMediaUrl = mediaResult.storedUrl;
          // Prefer provider-reported MIME over download content-type for consistency
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
