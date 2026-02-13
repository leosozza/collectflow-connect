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

    // Evolution API sends different event types
    const event = body.event;
    const instanceName = body.instance;

    if (!instanceName) {
      return new Response(JSON.stringify({ ok: true, skipped: "no instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the whatsapp_instance by instance_name
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, tenant_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!instance) {
      console.log("Instance not found:", instanceName);
      return new Response(JSON.stringify({ ok: true, skipped: "instance not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = instance.tenant_id;
    const instanceId = instance.id;

    // Handle message events
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
      const direction = fromMe ? "outbound" : "inbound";
      const externalId = msgData.key?.id || "";
      const pushName = msgData.pushName || "";

      // Determine message type and content
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

      // Find or create conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id, unread_count")
        .eq("tenant_id", tenantId)
        .eq("instance_id", instanceId)
        .eq("remote_phone", remotePhone)
        .maybeSingle();

      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
        const newUnread = direction === "inbound" ? (existingConv.unread_count || 0) + 1 : existingConv.unread_count;
        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: newUnread,
            remote_name: pushName || undefined,
            status: direction === "inbound" ? "open" : undefined,
          })
          .eq("id", conversationId);
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from("conversations")
          .insert({
            tenant_id: tenantId,
            instance_id: instanceId,
            remote_phone: remotePhone,
            remote_name: pushName || remotePhone,
            status: "open",
            unread_count: direction === "inbound" ? 1 : 0,
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (convErr) {
          console.error("Error creating conversation:", convErr);
          throw convErr;
        }
        conversationId = newConv.id;
      }

      // Check if message already exists (dedup by external_id)
      if (externalId) {
        const { data: existing } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("external_id", externalId)
          .maybeSingle();

        if (existing) {
          return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Insert message
      const { error: msgErr } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        direction,
        message_type: messageType,
        content: content || null,
        media_url: mediaUrl || null,
        media_mime_type: mediaMimeType || null,
        status: fromMe ? "sent" : "delivered",
        external_id: externalId || null,
      });

      if (msgErr) {
        console.error("Error inserting message:", msgErr);
        throw msgErr;
      }

      return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle message status updates
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

    // For other events, just acknowledge
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
