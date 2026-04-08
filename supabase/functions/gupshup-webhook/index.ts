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
    const payload = await req.json();
    console.log("Gupshup webhook payload:", JSON.stringify(payload).slice(0, 500));

    const eventType = payload.type || payload.eventType;

    // ===== Inbound message =====
    if (eventType === "message" || eventType === "message-event") {
      const msgPayload = payload.payload || {};
      const phone = msgPayload.source || msgPayload.sender?.phone;
      const senderName = msgPayload.sender?.name || phone || "";
      const msgType = msgPayload.type || "text";
      const content = msgPayload.payload?.text || msgPayload.payload?.caption || "";
      const mediaUrl = msgPayload.payload?.url || "";
      const externalId = msgPayload.id || payload.messageId || "";

      if (phone) {
        // Resolve instance: find gupshup instance by provider
        const { data: instance } = await supabase
          .from("whatsapp_instances")
          .select("instance_name")
          .eq("provider", "gupshup")
          .limit(1)
          .maybeSingle();

        const instanceName = instance?.instance_name;

        if (instanceName) {
          const canonicalType = msgType === "text" ? "text"
            : msgType === "image" ? "image"
            : msgType === "audio" ? "audio"
            : msgType === "video" ? "video"
            : msgType === "document" ? "document"
            : "text";

          // Single RPC call with instance_name — no separate tenant resolution
          const { data: result, error: rpcErr } = await supabase.rpc("ingest_channel_event_v2", {
            _instance_name: instanceName,
            _channel_type: "whatsapp",
            _provider: "gupshup",
            _remote_phone: phone,
            _remote_name: senderName,
            _direction: "inbound",
            _message_type: canonicalType,
            _content: content || null,
            _media_url: mediaUrl || null,
            _media_mime_type: null,
            _external_id: externalId || null,
            _provider_message_id: externalId || null,
            _actor_type: "human",
            _status: "delivered",
          });

          if (rpcErr) {
            console.error("ingest_channel_event_v2 error:", rpcErr);
          } else {
            console.log("Gupshup inbound ingested:", JSON.stringify(result));
          }
        } else {
          // Fallback: try tenant settings matching
          const destination = msgPayload.destination || payload.destination;
          if (destination) {
            const { data: tenants } = await supabase
              .from("tenants")
              .select("id, settings")
              .limit(10);

            for (const t of tenants || []) {
              const settings = t.settings as any;
              if (settings?.gupshup_source_number && destination.includes(settings.gupshup_source_number.replace(/\D/g, ""))) {
                const canonicalType = msgType === "text" ? "text"
                  : msgType === "image" ? "image"
                  : msgType === "audio" ? "audio"
                  : msgType === "video" ? "video"
                  : msgType === "document" ? "document"
                  : "text";

                // Use v1 RPC with tenant_id directly
                const { error: rpcErr } = await supabase.rpc("ingest_channel_event", {
                  _tenant_id: t.id,
                  _endpoint_id: null,
                  _channel_type: "whatsapp",
                  _provider: "gupshup",
                  _remote_phone: phone,
                  _remote_name: senderName,
                  _direction: "inbound",
                  _message_type: canonicalType,
                  _content: content || null,
                  _media_url: mediaUrl || null,
                  _media_mime_type: null,
                  _external_id: externalId || null,
                  _provider_message_id: externalId || null,
                  _actor_type: "human",
                  _status: "delivered",
                });
                if (rpcErr) console.error("ingest_channel_event error:", rpcErr);
                break;
              }
            }
          }
        }
      }
    }

    // ===== Status update (delivered, read, failed) =====
    if (eventType === "message-event" || eventType === "status") {
      const status = payload.payload?.type || payload.status;
      const gsMessageId = payload.payload?.gsId || payload.payload?.id || payload.messageId;

      if (gsMessageId && status) {
        const mappedStatus =
          status === "delivered" ? "delivered" :
          status === "read" ? "read" :
          status === "failed" || status === "error" ? "failed" :
          status === "sent" ? "sent" : status;

        // Update by external_id and provider_message_id
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
