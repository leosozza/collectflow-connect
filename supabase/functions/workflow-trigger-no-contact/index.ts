import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active workflows with trigger_type = 'first_contact'
    const { data: workflows, error: wfErr } = await supabase
      .from("workflow_flows")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_type", "first_contact");

    if (wfErr) throw wfErr;
    if (!workflows || workflows.length === 0) {
      return new Response(JSON.stringify({ message: "No active no-contact workflows" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    let triggered = 0;

    for (const wf of workflows) {
      const nodes: any[] = wf.nodes || [];
      const triggerNode = nodes.find((n: any) => n.data?.nodeType?.startsWith("trigger_"));
      const triggerDays = triggerNode?.data?.days || 7;

      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - triggerDays);
      const cutoffStr = cutoffDate.toISOString();

      // Get all active clients for this tenant
      const { data: clients, error: clErr } = await supabase
        .from("clients")
        .select("id")
        .eq("tenant_id", wf.tenant_id)
        .not("status", "in", '("pago","quebrado")');

      if (clErr || !clients || clients.length === 0) continue;

      for (const client of clients) {
        // Check last contact in message_logs
        const { data: lastMsg } = await supabase
          .from("message_logs")
          .select("created_at")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastContact = lastMsg?.[0]?.created_at;

        // If there's a recent contact, skip
        if (lastContact && new Date(lastContact) > cutoffDate) continue;

        // Check for duplicate execution
        const { count } = await supabase
          .from("workflow_executions")
          .select("id", { count: "exact", head: true })
          .eq("workflow_id", wf.id)
          .eq("client_id", client.id)
          .in("status", ["running", "waiting"]);

        if (count && count > 0) continue;

        // Trigger workflow
        try {
          await fetch(`${supabaseUrl}/functions/v1/workflow-engine`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              workflow_id: wf.id,
              client_id: client.id,
              trigger_type: "first_contact",
            }),
          });
          triggered++;
        } catch (e) {
          console.error(`Error triggering workflow ${wf.id} for client ${client.id}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, triggered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("workflow-trigger-no-contact error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
