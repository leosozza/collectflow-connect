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

  try {
    const payload = await req.json();
    console.log("Gupshup webhook payload:", JSON.stringify(payload));

    // Gupshup sends different event types
    const eventType = payload.type || payload.eventType;
    const phone = payload.payload?.destination || payload.destination;
    const status = payload.payload?.type || payload.status; // e.g. "delivered", "read", "failed"
    const messageId = payload.payload?.id || payload.messageId;

    if (phone && status) {
      // Try to find and update the most recent message_log for this phone
      const mappedStatus =
        status === "delivered" ? "delivered" :
        status === "read" ? "read" :
        status === "failed" || status === "error" ? "failed" :
        status === "sent" ? "sent" : status;

      const cleanPhone = phone.replace(/\D/g, "");

      const { data: logs } = await supabase
        .from("message_logs")
        .select("id")
        .eq("phone", cleanPhone)
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: false })
        .limit(1);

      if (logs && logs.length > 0) {
        await supabase
          .from("message_logs")
          .update({ status: mappedStatus })
          .eq("id", logs[0].id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("gupshup-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
