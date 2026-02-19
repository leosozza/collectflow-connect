import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: ExecutionRequest = await req.json();
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
      // Find trigger node (no incoming edges)
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
        // Update current node
        await supabase
          .from("workflow_executions")
          .update({ current_node_id: currentNodeId })
          .eq("id", execId);

        if (nodeType?.startsWith("trigger_")) {
          logEntry.result = "trigger_fired";
        } else if (nodeType === "action_whatsapp") {
          const template = node.data?.message_template || "";
          const message = template
            .replace(/\{\{nome\}\}/g, client.nome_completo)
            .replace(/\{\{cpf\}\}/g, client.cpf)
            .replace(/\{\{valor\}\}/g, String(client.valor_parcela));

          // Try to send via evolution-proxy
          try {
            const phone = (client.phone || "").replace(/\D/g, "");
            if (phone) {
              const { data: instances } = await supabase
                .from("whatsapp_instances")
                .select("instance_name")
                .eq("tenant_id", workflow.tenant_id)
                .eq("status", "connected")
                .limit(1);

              if (instances && instances.length > 0) {
                await fetch(`${supabaseUrl}/functions/v1/evolution-proxy`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    endpoint: `/message/sendText/${instances[0].instance_name}`,
                    method: "POST",
                    body: { number: phone, text: message },
                    tenant_id: workflow.tenant_id,
                  }),
                });
              }
            }
            logEntry.result = "whatsapp_sent";
          } catch (e: any) {
            logEntry.result = "whatsapp_error";
            logEntry.error = e.message;
          }
        } else if (nodeType === "action_sms") {
          logEntry.result = "sms_queued";
        } else if (nodeType === "action_wait") {
          const days = node.data?.days || 1;
          const nextRun = new Date();
          nextRun.setDate(nextRun.getDate() + days);

          // Find next node
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
