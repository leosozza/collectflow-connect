import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendByProvider } from "../_shared/whatsapp-sender.ts";
import { resolveTemplate } from "../_shared/template-resolver.ts";
import { logMessage } from "../_shared/message-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExecutionRequest {
  workflow_id: string;
  client_id: string;
  trigger_type?: string;
  trigger_data?: Record<string, any>;
  resume_from_node?: string;
  execution_id?: string;
  webhook_token?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ExecutionRequest = await req.json();

    // Handle webhook trigger: find matching workflows by token
    if (body.trigger_type === "webhook" && body.webhook_token) {
      const { data: wfs } = await supabase
        .from("workflow_flows")
        .select("*")
        .eq("is_active", true)
        .eq("trigger_type", "webhook");

      if (!wfs || wfs.length === 0) {
        return new Response(JSON.stringify({ error: "No webhook workflows found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let matchedWf: any = null;
      for (const wf of wfs) {
        const nodes: any[] = wf.nodes || [];
        const triggerNode = nodes.find((n: any) => n.data?.nodeType === "trigger_webhook");
        if (triggerNode?.data?.webhook_token === body.webhook_token) {
          matchedWf = wf;
          break;
        }
      }

      if (!matchedWf) {
        return new Response(JSON.stringify({ error: "Invalid webhook token" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!body.client_id) {
        return new Response(JSON.stringify({ error: "client_id is required for webhook triggers" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count } = await supabase
        .from("workflow_executions")
        .select("id", { count: "exact", head: true })
        .eq("workflow_id", matchedWf.id)
        .eq("client_id", body.client_id)
        .in("status", ["running", "waiting"]);

      if (count && count > 0) {
        return new Response(JSON.stringify({ message: "Execution already active" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      body.workflow_id = matchedWf.id;
    }

    const { workflow_id, client_id, resume_from_node, execution_id } = body;

    // Load workflow
    const { data: workflow, error: wfErr } = await supabase
      .from("workflow_flows")
      .select("*")
      .eq("id", workflow_id)
      .single();

    if (wfErr || !workflow) {
      return new Response(JSON.stringify({ error: "Workflow not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!workflow.is_active) {
      return new Response(JSON.stringify({ error: "Workflow is inactive" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load client
    const { data: client, error: clErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();

    if (clErr || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nodes: any[] = workflow.nodes || [];
    const edges: any[] = workflow.edges || [];
    const executionLog: any[] = [];

    // Create or resume execution
    let execId = execution_id;
    if (!execId) {
      const { data: exec, error: execErr } = await supabase
        .from("workflow_executions")
        .insert({
          tenant_id: workflow.tenant_id,
          workflow_id,
          client_id,
          status: "running",
          execution_log: [],
        })
        .select()
        .single();
      if (execErr) throw execErr;
      execId = exec.id;
    } else {
      await supabase
        .from("workflow_executions")
        .update({ status: "running" })
        .eq("id", execId);
    }

    // Find start node
    let currentNodeId = resume_from_node;
    if (!currentNodeId) {
      const targetIds = new Set(edges.map((e: any) => e.target));
      const triggerNode = nodes.find((n: any) => !targetIds.has(n.id));
      currentNodeId = triggerNode?.id;
    }

    // Execute nodes
    let safetyCounter = 0;
    while (currentNodeId && safetyCounter < 50) {
      safetyCounter++;
      const node = nodes.find((n: any) => n.id === currentNodeId);
      if (!node) break;

      const nodeType = node.data?.nodeType as string;
      const logEntry: any = { node_id: node.id, nodeType, timestamp: new Date().toISOString() };

      try {
        await supabase
          .from("workflow_executions")
          .update({ current_node_id: currentNodeId })
          .eq("id", execId);

        if (nodeType?.startsWith("trigger_")) {
          logEntry.result = "trigger_fired";

        // Fase 5: action_whatsapp usando motor unificado
        } else if (nodeType === "action_whatsapp") {
          const template = node.data?.message_template || "";
          // Fase 2: resolvedor unificado (suporta {{valor}}, {{valor_parcela}}, etc.)
          const message = resolveTemplate(template, client);

          const phone = (client.phone || "").replace(/\D/g, "");
          let sendOk = false;
          let sendError = "";
          let providerMessageId: string | null = null;
          let providerUsed = "";
          let instanceName = "";
          let instanceId: string | null = null;

          if (phone) {
            // Load tenant settings for provider credentials
            const { data: tenantData } = await supabase
              .from("tenants")
              .select("settings")
              .eq("id", workflow.tenant_id)
              .single();
            const tenantSettings = (tenantData?.settings || {}) as Record<string, any>;

            // Find default instance (any provider, not just Evolution)
            const { data: instances } = await supabase
              .from("whatsapp_instances")
              .select("id, instance_name, instance_url, api_key, provider")
              .eq("tenant_id", workflow.tenant_id)
              .in("status", ["connected", "active", "open"])
              .order("is_default", { ascending: false })
              .limit(1);

            const inst = instances?.[0] || null;

            // Check Gupshup fallback if no DB instance
            const gupshupConfigured = !!(tenantSettings.gupshup_api_key && tenantSettings.gupshup_source_number);

            const resolvedInst = inst || (gupshupConfigured
              ? { provider: "gupshup", instance_name: tenantSettings.gupshup_app_name || "gupshup" }
              : null);

            if (resolvedInst) {
              const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "") || "";
              const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
              const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
              const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

              // Fase 1: motor unificado de envio
              const sendResult = await sendByProvider(
                resolvedInst, phone, message, tenantSettings,
                evolutionUrl, evolutionKey, wuzapiUrl, wuzapiAdminToken
              );

              sendOk = sendResult.ok;
              providerMessageId = sendResult.providerMessageId;
              providerUsed = sendResult.provider;
              instanceName = resolvedInst.instance_name || "";
              instanceId = inst?.id || null;

              if (!sendOk) {
                sendError = JSON.stringify(sendResult.result);
              }
            } else {
              sendError = "Nenhuma instância WhatsApp configurada";
            }
          } else {
            sendError = "Cliente sem telefone";
          }

          // Fase 3: logger unificado com rastreabilidade de workflow
          await logMessage(supabase, {
            tenant_id: workflow.tenant_id,
            client_id: client_id,
            client_cpf: client.cpf,
            phone: phone || null,
            status: sendOk ? "sent" : "failed",
            message_body: message,
            error_message: sendError || null,
            sent_at: sendOk ? new Date().toISOString() : null,
            metadata: {
              source_type: "workflow",
              workflow_id,
              execution_id: execId!,
              node_id: node.id,
              provider: providerUsed,
              provider_message_id: providerMessageId,
              instance_id: instanceId,
              instance_name: instanceName,
            },
          });

          logEntry.result = sendOk ? "whatsapp_sent" : "whatsapp_error";
          if (sendError) logEntry.error = sendError;

        } else if (nodeType === "action_sms") {
          logEntry.result = "sms_queued";
        } else if (nodeType === "action_wait") {
          const days = node.data?.days || 1;
          const nextRun = new Date();
          nextRun.setDate(nextRun.getDate() + days);

          const outEdge = edges.find((e: any) => e.source === currentNodeId);
          const nextNodeId = outEdge?.target || null;

          executionLog.push(logEntry);

          await supabase
            .from("workflow_executions")
            .update({
              status: "waiting",
              next_run_at: nextRun.toISOString(),
              current_node_id: nextNodeId,
              execution_log: executionLog,
            })
            .eq("id", execId);

          return new Response(
            JSON.stringify({ success: true, status: "waiting", execution_id: execId, next_run_at: nextRun.toISOString() }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else if (nodeType === "action_ai_negotiate") {
          logEntry.result = "ai_negotiate_queued";
        } else if (nodeType === "action_update_status") {
          const newStatus = node.data?.new_status;
          if (newStatus) {
            await supabase
              .from("clients")
              .update({ status: newStatus })
              .eq("id", client_id);
            logEntry.result = `status_updated_to_${newStatus}`;
          }
        } else if (nodeType === "condition_score" || nodeType === "condition_value") {
          const op = node.data?.operator || ">";
          const val = node.data?.value || 0;
          const clientVal = nodeType === "condition_score"
            ? (client.propensity_score || 0)
            : (client.valor_parcela || 0);

          const result = op === ">" ? clientVal > val : clientVal < val;
          logEntry.result = result ? "condition_yes" : "condition_no";

          executionLog.push(logEntry);

          const handleId = result ? "yes" : "no";
          const outEdge = edges.find(
            (e: any) => e.source === currentNodeId && (e.sourceHandle === handleId || (!e.sourceHandle && handleId === "yes"))
          );
          currentNodeId = outEdge?.target || null;
          continue;
        }

        executionLog.push(logEntry);

        // Move to next node
        const outEdge = edges.find((e: any) => e.source === currentNodeId);
        currentNodeId = outEdge?.target || null;
      } catch (err: any) {
        logEntry.error = err.message;
        executionLog.push(logEntry);

        await supabase
          .from("workflow_executions")
          .update({
            status: "error",
            error_message: err.message,
            execution_log: executionLog,
          })
          .eq("id", execId);

        return new Response(
          JSON.stringify({ error: err.message, execution_id: execId }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Complete
    await supabase
      .from("workflow_executions")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        execution_log: executionLog,
      })
      .eq("id", execId);

    return new Response(
      JSON.stringify({ success: true, status: "done", execution_id: execId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Workflow engine error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
