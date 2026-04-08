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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const event = body.event;
    const instanceName = body.instance;

    if (!instanceName) {
      return new Response(JSON.stringify({ ok: true, skipped: "no instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Handle connection state changes (needs instance lookup) =====
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

    // ===== Handle message events via consolidated RPC v2 =====
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

      // Parse message content
      let messageType = "text";
      let content = "";
      let mediaUrl = "";
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
        mediaUrl = msgData.mediaUrl || "";
      } else if (msg?.audioMessage) {
        messageType = "audio";
        mediaMimeType = msg.audioMessage.mimetype || "audio/ogg";
        mediaUrl = msgData.mediaUrl || "";
      } else if (msg?.videoMessage) {
        messageType = "video";
        content = msg.videoMessage.caption || "";
        mediaMimeType = msg.videoMessage.mimetype || "video/mp4";
        mediaUrl = msgData.mediaUrl || "";
      } else if (msg?.documentMessage) {
        messageType = "document";
        content = msg.documentMessage.fileName || "";
        mediaMimeType = msg.documentMessage.mimetype || "application/octet-stream";
        mediaUrl = msgData.mediaUrl || "";
      } else if (msg?.stickerMessage) {
        messageType = "sticker";
        mediaUrl = msgData.mediaUrl || "";
      }

      // Single RPC call — no separate instance lookup needed
      const { data: result, error: rpcErr } = await supabase.rpc("ingest_channel_event_v2", {
        _instance_name: instanceName,
        _channel_type: "whatsapp",
        _remote_phone: remotePhone,
        _remote_name: pushName || remotePhone,
        _direction: fromMe ? "outbound" : "inbound",
        _message_type: messageType,
        _content: content || null,
        _media_url: mediaUrl || null,
        _media_mime_type: mediaMimeType || null,
        _external_id: externalId || null,
        _provider_message_id: null,
        _actor_type: "human",
        _status: fromMe ? "sent" : "delivered",
      });

      if (rpcErr) {
        console.error("ingest_channel_event_v2 error:", rpcErr);
        throw rpcErr;
      }

      console.log("Ingested:", JSON.stringify(result));

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
    console.error("whatsapp-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
