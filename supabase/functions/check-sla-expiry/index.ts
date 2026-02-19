import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find open conversations with expired SLA that haven't been notified
    const { data: expiredConvs, error } = await supabase
      .from("conversations")
      .select("id, tenant_id, assigned_to, remote_name, remote_phone, sla_deadline_at")
      .in("status", ["open", "waiting"])
      .lt("sla_deadline_at", new Date().toISOString())
      .is("sla_notified_at", null)
      .not("assigned_to", "is", null);

    if (error) {
      console.error("Error fetching expired conversations:", error);
      throw error;
    }

    if (!expiredConvs || expiredConvs.length === 0) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${expiredConvs.length} conversations with expired SLA`);

    let notifiedCount = 0;

    for (const conv of expiredConvs) {
      const displayName = conv.remote_name || conv.remote_phone;

      // Insert notification for the assigned operator
      const { error: notifErr } = await supabase.from("notifications").insert({
        tenant_id: conv.tenant_id,
        user_id: conv.assigned_to,
        title: "SLA Expirado",
        message: `A conversa com ${displayName} excedeu o prazo de atendimento`,
        type: "warning",
        reference_type: "conversation",
        reference_id: conv.id,
      });

      if (notifErr) {
        console.error("Error inserting notification for conv", conv.id, notifErr);
        continue;
      }

      // Mark conversation as notified
      await supabase
        .from("conversations")
        .update({ sla_notified_at: new Date().toISOString() })
        .eq("id", conv.id);

      notifiedCount++;
    }

    console.log(`Notified ${notifiedCount} operators about expired SLA`);

    return new Response(JSON.stringify({ ok: true, notified: notifiedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("check-sla-expiry error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
