import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, service_code, amount, description, reference_id, reference_type, metadata } = await req.json();

    if (!tenant_id || !service_code || !amount || !description) {
      return new Response(JSON.stringify({ error: "tenant_id, service_code, amount, and description are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify service is active for this tenant
    const { data: svc } = await supabase
      .from("service_catalog")
      .select("id, tokens_required")
      .eq("service_code", service_code)
      .eq("is_active", true)
      .single();

    if (!svc) {
      return new Response(JSON.stringify({ error: "Service not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tenantSvc } = await supabase
      .from("tenant_services")
      .select("status")
      .eq("tenant_id", tenant_id)
      .eq("service_id", svc.id)
      .eq("status", "active")
      .single();

    if (!tenantSvc) {
      return new Response(JSON.stringify({ error: "Service not active for this tenant" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Consume tokens
    const { data: result, error: consumeError } = await supabase.rpc("consume_tokens", {
      p_tenant_id: tenant_id,
      p_amount: amount,
      p_service_code: service_code,
      p_description: description,
      p_reference_id: reference_id || null,
      p_reference_type: reference_type || null,
      p_metadata: metadata || {},
    });

    if (consumeError) {
      return new Response(JSON.stringify({ error: consumeError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const res = Array.isArray(result) ? result[0] : result;

    if (!res?.success) {
      return new Response(
        JSON.stringify({ error: res?.error_message || "Failed to consume tokens", balance: res?.new_balance }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log usage
    await supabase.from("service_usage_logs").insert({
      tenant_id,
      service_code,
      tokens_consumed: amount,
      usage_type: reference_type || "general",
      target_entity_id: reference_id ? reference_id : undefined,
      status: "success",
      created_by: user.id,
    });

    // Check low balance alert
    const { data: tokenInfo } = await supabase
      .from("tenant_tokens")
      .select("token_balance, low_balance_threshold")
      .eq("tenant_id", tenant_id)
      .single();

    const lowBalance = tokenInfo && tokenInfo.token_balance < (tokenInfo.low_balance_threshold || 100);

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: res.new_balance,
        transaction_id: res.transaction_id,
        low_balance_alert: lowBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
