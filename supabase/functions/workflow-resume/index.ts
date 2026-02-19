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

    // Find waiting executions ready to resume
    const { data: executions, error } = await supabase
      .from("workflow_executions")
      .select("*")
      .eq("status", "waiting")
      .lte("next_run_at", new Date().toISOString())
      .limit(100);

    if (error) throw error;

    const results: any[] = [];

    for (const exec of executions || []) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/workflow-engine`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            workflow_id: exec.workflow_id,
            client_id: exec.client_id,
            resume_from_node: exec.current_node_id,
            execution_id: exec.id,
          }),
        });

        const result = await response.json();
        results.push({ execution_id: exec.id, ...result });
      } catch (err: any) {
        console.error(`Error resuming execution ${exec.id}:`, err.message);
        results.push({ execution_id: exec.id, error: err.message });
      }
    }

    console.log(`Workflow resume: processed ${results.length} executions`);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Workflow resume error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
