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

    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Mark all pending clients with due date <= yesterday as quebrado
    const { data, error } = await supabase
      .from("clients")
      .update({ status: "quebrado", valor_pago: 0 })
      .eq("status", "pendente")
      .lte("data_vencimento", yesterdayStr)
      .select("id");

    if (error) {
      console.error("Error auto-breaking overdue clients:", error);
      return new Response(
        JSON.stringify({ error: "Failed to process overdue clients" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const count = data?.length || 0;
    console.log(`Auto-break: ${count} overdue clients marked as quebrado (due <= ${yesterdayStr})`);

    return new Response(
      JSON.stringify({ success: true, updated: count, cutoff_date: yesterdayStr }),
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
