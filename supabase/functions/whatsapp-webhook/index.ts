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

    // Helper: find client by phone number (auto-link)
    const findClientByPhone = async (phone: string): Promise<string | null> => {
      const digits = phone.replace(/\D/g, "");
      if (!digits) return null;

      // Build phone variants to search
      const variants: string[] = [digits];
      // Without country code (55)
      if (digits.startsWith("55") && digits.length >= 12) {
        variants.push(digits.slice(2));
      }
      // With country code
      if (!digits.startsWith("55") && digits.length >= 10) {
        variants.push("55" + digits);
      }

      for (const variant of variants) {
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .eq("tenant_id", tenantId)
          .like("phone", `%${variant.slice(-10)}%`)
          .limit(1)
          .maybeSingle();

        if (client) return client.id;
      }
      return null;
    };

    // Helper: get SLA minutes (per-credor first, then tenant fallback)
    const getSlaMinutes = async (clientId?: string | null): Promise<number> => {
      // Try per-credor SLA if client is linked
      if (clientId) {
        const { data: client } = await supabase
          .from("clients")
          .select("credor")
          .eq("id", clientId)
          .maybeSingle();
        if (client?.credor) {
          const { data: credor } = await supabase
            .from("credores")
            .select("sla_hours")
            .eq("tenant_id", tenantId)
            .eq("razao_social", client.credor)
            .maybeSingle();
          if (credor?.sla_hours != null) {
            console.log("Using credor SLA:", credor.sla_hours, "hours");
            return credor.sla_hours * 60;
          }
        }
      }
      // Fallback to tenant global
      const { data: tenant } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenantId)
        .single();
      const settings = tenant?.settings as any;
      return settings?.sla_minutes || 30;
    };

    // Helper: round-robin assignment
    const assignRoundRobin = async (): Promise<string | null> => {
      // Get operators linked to this instance
      const { data: operators } = await supabase
        .from("operator_instances")
        .select("profile_id")
        .eq("instance_id", instanceId)
        .eq("tenant_id", tenantId);

      if (!operators || operators.length === 0) return null;

      const profileIds = operators.map((o: any) => o.profile_id);

      // Count open conversations per operator
      const { data: convCounts } = await supabase
        .from("conversations")
        .select("assigned_to")
        .eq("tenant_id", tenantId)
        .eq("status", "open")
        .in("assigned_to", profileIds);

      const countMap: Record<string, number> = {};
      for (const pid of profileIds) {
        countMap[pid] = 0;
      }
      if (convCounts) {
        for (const c of convCounts) {
          if (c.assigned_to && countMap[c.assigned_to] !== undefined) {
            countMap[c.assigned_to]++;
          }
        }
      }

      // Find operator with fewest open conversations
      let minCount = Infinity;
      let assignee: string | null = null;
      for (const pid of profileIds) {
        if (countMap[pid] < minCount) {
          minCount = countMap[pid];
          assignee = pid;
        }
      }

      return assignee;
    };

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
        .select("id, unread_count, assigned_to, client_id")
        .eq("tenant_id", tenantId)
        .eq("instance_id", instanceId)
        .eq("remote_phone", remotePhone)
        .maybeSingle();

      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
        const newUnread = direction === "inbound" ? (existingConv.unread_count || 0) + 1 : existingConv.unread_count;

        const updateData: any = {
          last_message_at: new Date().toISOString(),
          unread_count: newUnread,
          remote_name: direction === "inbound" && pushName ? pushName : undefined,
        };

        if (direction === "inbound") {
          updateData.status = "open";
          const linkedClientId = existingConv.client_id || updateData.client_id || null;
          const slaMinutes = await getSlaMinutes(linkedClientId);
          updateData.sla_deadline_at = new Date(Date.now() + slaMinutes * 60 * 1000).toISOString();
          updateData.sla_notified_at = null; // reset notification flag
        } else {
          updateData.sla_deadline_at = null;
        }

        // Auto-link client if not yet linked
        if (!existingConv.client_id) {
          const clientId = await findClientByPhone(remotePhone);
          if (clientId) {
            updateData.client_id = clientId;
            console.log("Auto-linked client", clientId, "to existing conversation", conversationId);
          }
        }

        await supabase
          .from("conversations")
          .update(updateData)
          .eq("id", conversationId);
      } else {
        // Auto-link client for new conversation
        const clientId = await findClientByPhone(remotePhone);
        if (clientId) {
          console.log("Auto-linking client", clientId, "to new conversation for phone", remotePhone);
        }

        const assignedTo = direction === "inbound" ? await assignRoundRobin() : null;
        const slaMinutes = await getSlaMinutes(clientId);

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
            assigned_to: assignedTo,
            client_id: clientId,
            sla_deadline_at: direction === "inbound"
              ? new Date(Date.now() + slaMinutes * 60 * 1000).toISOString()
              : null,
          })
          .select("id")
          .single();

        if (convErr) {
          console.error("Error creating conversation:", convErr);
          throw convErr;
        }
        conversationId = newConv.id;
      }

      // Dedup
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
