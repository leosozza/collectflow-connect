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
  const webhookSecret = Deno.env.get("THREECPLUS_WEBHOOK_SECRET");

  try {
    // Optional secret validation via query param or header
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("secret");
    const tokenHeader = req.headers.get("x-webhook-secret");
    const providedSecret = tokenParam || tokenHeader;

    if (webhookSecret && providedSecret !== webhookSecret) {
      console.warn("threecplus-webhook: invalid secret provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    console.log("threecplus-webhook payload:", JSON.stringify(payload).substring(0, 2000));

    const event = payload.event || payload.type || payload.action;
    const data = payload.data || payload;
    const domain = payload.domain || payload.company_domain || data?.domain || data?.company_domain;

    if (!event) {
      console.warn("threecplus-webhook: no event type in payload");
      return new Response(JSON.stringify({ ok: true, warning: "no event type" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve tenant by 3CPlus domain
    let tenantId: string | null = null;
    if (domain) {
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, settings")
        .eq("status", "active");

      if (tenants) {
        for (const t of tenants) {
          const settings = (t.settings as Record<string, any>) || {};
          const tenantDomain = (settings.threecplus_domain || "")
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");
          if (tenantDomain && tenantDomain === cleanDomain) {
            tenantId = t.id;
            break;
          }
        }
      }
    }

    if (!tenantId) {
      console.warn(`threecplus-webhook: could not resolve tenant for domain "${domain}"`);
      return new Response(JSON.stringify({ ok: true, warning: "tenant not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`threecplus-webhook: tenant=${tenantId}, event=${event}`);

    // Extract common call data
    const callId = data.call_id || data.id;
    const phone = data.phone || data.phone_number || data.destination;
    const agentId = data.agent_id || data.user_id;
    const agentName = data.agent_name || data.user_name;
    const campaignId = data.campaign_id;
    const campaignName = data.campaign_name;
    const duration = data.duration || data.talk_time || data.duration_seconds;
    const recordingUrl = data.recording_url || data.recording;
    const qualification = data.qualification || data.qualification_name;
    const qualificationId = data.qualification_id;

    // Try to find the client by phone
    let clientId: string | null = null;
    let clientCpf: string | null = null;
    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, "");
      const phoneSuffix = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;

      if (phoneSuffix.length >= 8) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, cpf")
          .eq("tenant_id", tenantId)
          .or(`phone.ilike.%${phoneSuffix},phone2.ilike.%${phoneSuffix},phone3.ilike.%${phoneSuffix}`)
          .limit(1);

        if (clients && clients.length > 0) {
          clientId = clients[0].id;
          clientCpf = clients[0].cpf;
        }
      }
    }

    // Process based on event type
    switch (event) {
      case "call.started":
      case "call_started":
      case "ringing": {
        const { error } = await supabase.from("call_logs").insert({
          tenant_id: tenantId,
          external_id: callId ? String(callId) : null,
          client_id: clientId,
          client_cpf: clientCpf || "",
          phone: phone ? String(phone).replace(/\D/g, "") : null,
          agent_id: agentId ? String(agentId) : null,
          agent_name: agentName || null,
          campaign_id: campaignId ? String(campaignId) : null,
          campaign_name: campaignName || null,
          status: "ringing",
          direction: data.direction || "outbound",
          called_at: new Date().toISOString(),
        });
        if (error) console.error("threecplus-webhook: insert call_log error:", error);
        else console.log(`threecplus-webhook: call.started logged for call ${callId}`);
        break;
      }

      case "call.answered":
      case "call_answered":
      case "answered": {
        if (callId) {
          const { error } = await supabase
            .from("call_logs")
            .update({ status: "in_progress" })
            .eq("tenant_id", tenantId)
            .eq("external_id", String(callId));
          if (error) console.error("threecplus-webhook: update call_log error:", error);
          else console.log(`threecplus-webhook: call.answered updated for call ${callId}`);
        }
        break;
      }

      case "call.finished":
      case "call_finished":
      case "hangup":
      case "finished": {
        if (callId) {
          const { data: existing } = await supabase
            .from("call_logs")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("external_id", String(callId))
            .limit(1);

          const callData = {
            tenant_id: tenantId,
            external_id: String(callId),
            client_id: clientId,
            client_cpf: clientCpf || "",
            phone: phone ? String(phone).replace(/\D/g, "") : null,
            agent_id: agentId ? String(agentId) : null,
            agent_name: agentName || null,
            campaign_id: campaignId ? String(campaignId) : null,
            campaign_name: campaignName || null,
            status: "completed",
            direction: data.direction || "outbound",
            duration_seconds: duration ? Number(duration) : null,
            recording_url: recordingUrl || null,
            called_at: data.started_at || data.call_started_at || new Date().toISOString(),
          };

          if (existing && existing.length > 0) {
            const { error } = await supabase
              .from("call_logs")
              .update({
                status: "completed",
                duration_seconds: callData.duration_seconds,
                recording_url: callData.recording_url,
                client_id: clientId || undefined,
                client_cpf: clientCpf || undefined,
              })
              .eq("id", existing[0].id);
            if (error) console.error("threecplus-webhook: update call_log error:", error);
          } else {
            const { error } = await supabase.from("call_logs").insert(callData);
            if (error) console.error("threecplus-webhook: insert call_log error:", error);
          }
          console.log(`threecplus-webhook: call.finished processed for call ${callId}`);
        }
        break;
      }

      case "call.qualified":
      case "call_qualified":
      case "qualified": {
        // Update call_log with qualification
        if (callId) {
          const { error } = await supabase
            .from("call_logs")
            .update({
              qualification: qualification || null,
              qualification_id: qualificationId ? String(qualificationId) : null,
            })
            .eq("tenant_id", tenantId)
            .eq("external_id", String(callId));
          if (error) console.error("threecplus-webhook: update qualification error:", error);
        }

        // CORRECTION 4: Map to call_disposition by ID first, then label fallback
        if (clientId && (qualificationId || qualification)) {
          let matchedDispType: any = null;

          // Priority 1: Match by threecplus_qualification_id (robust, ID-based)
          if (qualificationId) {
            const { data: byId } = await supabase
              .from("call_disposition_types")
              .select("id, key")
              .eq("tenant_id", tenantId)
              .eq("threecplus_qualification_id", Number(qualificationId))
              .limit(1);
            if (byId && byId.length > 0) {
              matchedDispType = byId[0];
              console.log(`threecplus-webhook: matched disposition by qualification_id ${qualificationId} → key "${matchedDispType.key}"`);
            }
          }

          // Priority 2: Fallback to label match (fragile, text-based)
          if (!matchedDispType && qualification) {
            const { data: byLabel } = await supabase
              .from("call_disposition_types")
              .select("id, key")
              .eq("tenant_id", tenantId)
              .ilike("label", qualification)
              .limit(1);
            if (byLabel && byLabel.length > 0) {
              matchedDispType = byLabel[0];
              console.log(`threecplus-webhook: matched disposition by label "${qualification}" → key "${matchedDispType.key}"`);
            }
          }

          if (matchedDispType) {
            // Find the operator's profile_id via threecplus_agent_id
            let operatorId: string | null = null;
            if (agentId) {
              const { data: matchedProfiles } = await supabase
                .from("profiles")
                .select("id")
                .eq("tenant_id", tenantId)
                .eq("threecplus_agent_id", String(agentId))
                .limit(1);
              if (matchedProfiles && matchedProfiles.length > 0) {
                operatorId = matchedProfiles[0].id;
              }
            }

            const { error: dispError } = await supabase
              .from("call_dispositions")
              .insert({
                tenant_id: tenantId,
                client_id: clientId,
                disposition_type: matchedDispType.key,
                operator_id: operatorId,
                notes: `Qualificação automática via 3CPlus: ${qualification || `ID ${qualificationId}`}`,
                source: "webhook",
              });
            if (dispError) console.error("threecplus-webhook: insert disposition error:", dispError);
            else console.log(`threecplus-webhook: disposition created for qualification "${qualification || qualificationId}"`);
          } else {
            console.warn(`threecplus-webhook: no matching disposition for qualification_id=${qualificationId} label="${qualification}"`);
          }
        }
        break;
      }

      case "agent.status_changed":
      case "agent_status_changed": {
        console.log(`threecplus-webhook: agent status changed - agent=${agentId}, status=${data.status}, name=${agentName}`);
        break;
      }

      default:
        console.log(`threecplus-webhook: unhandled event "${event}"`);
    }

    return new Response(JSON.stringify({ ok: true, event, tenant_id: tenantId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("threecplus-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
