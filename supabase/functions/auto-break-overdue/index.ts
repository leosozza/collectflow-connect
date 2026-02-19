import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get date 48 hours ago
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // Mark all pending clients with due date <= yesterday as quebrado
    const { data, error } = await supabase
      .from("clients")
      .update({ status: "quebrado", valor_pago: 0 })
      .eq("status", "pendente")
      .lte("data_vencimento", cutoffStr)
      .select("id");

    if (error) {
      console.error("Error auto-breaking overdue clients:", error);
      return new Response(
        JSON.stringify({ error: "Failed to process overdue clients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const count = data?.length || 0;
    console.log(`Auto-break: ${count} overdue clients marked as quebrado (due <= ${cutoffStr}, 48h rule)`);

    // Trigger workflow engine for each broken client
    if (count > 0) {
      const { data: workflows } = await supabase
        .from("workflow_flows")
        .select("id, tenant_id")
        .eq("is_active", true)
        .eq("trigger_type", "agreement_broken");

      if (workflows && workflows.length > 0) {
        for (const client of data!) {
          for (const wf of workflows) {
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
                  trigger_type: "agreement_broken",
                }),
              });
            } catch (e) {
              console.error(`Failed to trigger workflow ${wf.id} for client ${client.id}:`, e);
            }
          }
        }
        console.log(`Triggered ${workflows.length} workflow(s) for ${count} client(s)`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated: count, cutoff_date: cutoffStr }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
