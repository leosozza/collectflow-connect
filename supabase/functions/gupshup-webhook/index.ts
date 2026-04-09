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

  try {
    const payload = await req.json();
    console.log("Gupshup webhook payload (full):", JSON.stringify(payload));
    
    // Log the incoming webhook
    await writeLog(null, "inbound", `Webhook recebido: type=${payload.type || payload.eventType}`, payload, 200);

    const eventType = payload.type || payload.eventType || (payload.payload?.type === "text" ? "message" : null);

    // ===== Inbound message =====
    if (eventType === "message" || eventType === "message-event") {
      const msgPayload = payload.payload || {};
      
      // GupShup format varies: sometimes it's payload.payload.source, sometimes payload.sender.phone
      const phone = msgPayload.source || msgPayload.sender?.phone || payload.sender?.phone;
      const senderName = msgPayload.sender?.name || payload.sender?.name || phone || "";
      const msgType = msgPayload.type || "text";
      const content = msgPayload.payload?.text || msgPayload.payload?.caption || payload.payload?.text || "";
      const mediaUrl = msgPayload.payload?.url || payload.payload?.url || "";
      const externalId = msgPayload.id || payload.messageId || payload.payload?.id || "";
      
      const destination = msgPayload.destination || payload.destination || "";

      console.log(`Processing GupShup inbound: from=${phone}, to=${destination}, type=${msgType}, externalId=${externalId}`);

      if (phone) {
        // Resolve instance: Try #1 - Explicit instance by provider='gupshup'
        // If we have destination, we can filter better in the future, 
        // but for now let's find the tenant that has this source number in settings.
        
        let targetTenantId: string | null = null;
        let targetInstanceName: string | null = null;

        // Fetch all tenants with gupshup settings to find a match
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
            console.log(`Matched tenant ${t.id} via source number settings: ${cleanSource}`);
            break;
          }
        }

        // Try #2: If not found by settings, check whatsapp_instances
        if (!targetTenantId) {
          const { data: instance } = await supabase
            .from("whatsapp_instances")
            .select("instance_name, tenant_id")
            .eq("provider", "gupshup")
            .limit(1)
            .maybeSingle(); // Fallback to first one found if only one exists
            
          if (instance) {
            targetTenantId = instance.tenant_id;
            targetInstanceName = instance.instance_name;
            console.log(`Matched tenant ${targetTenantId} via whatsapp_instances fallback`);
          }
        }

        if (targetTenantId) {
          const canonicalType = msgType === "text" ? "text"
            : msgType === "image" ? "image"
            : msgType === "audio" ? "audio"
            : msgType === "video" ? "video"
            : msgType === "document" ? "document"
            : "text";

          // Use the appropriate RPC
          const { data: result, error: rpcErr } = await supabase.rpc(targetInstanceName ? "ingest_channel_event_v2" : "ingest_channel_event", {
            ...(targetInstanceName ? { _instance_name: targetInstanceName } : { _tenant_id: targetTenantId }),
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
            console.error("Ingest error:", rpcErr);
            await writeLog(targetTenantId, "error", `Erro ao ingerir mensagem: ${rpcErr.message}`, { phone, externalId }, 500);
          } else {
            console.log("Gupshup inbound ingested:", JSON.stringify(result));
            await writeLog(targetTenantId, "success", `Mensagem ingerida: from=${phone}, type=${msgType}`, result, 200);
          }
        } else {
          console.warn("Could not resolve tenant for destination:", destination);
          await writeLog(null, "warning", `Tenant não encontrado para destino: ${destination}`, { phone, destination }, 404);
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
    await writeLog(null, "error", `Erro geral: ${err.message}`, null, 500);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
