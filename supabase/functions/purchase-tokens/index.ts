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

    const { package_id, payment_method } = await req.json();

    if (!package_id || !payment_method) {
      return new Response(JSON.stringify({ error: "package_id and payment_method are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get user's tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["admin", "super_admin"].includes(tenantUser.role)) {
      return new Response(JSON.stringify({ error: "Only admins can purchase tokens" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get package
    const { data: pkg, error: pkgError } = await supabase
      .from("token_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single();

    if (pkgError || !pkg) {
      return new Response(JSON.stringify({ error: "Package not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create payment record
    const { data: payment, error: payError } = await supabase
      .from("payment_records")
      .insert({
        tenant_id: tenantUser.tenant_id,
        payment_type: "token_purchase",
        amount: pkg.price,
        status: "pending",
        payment_method,
        token_package_id: pkg.id,
        tokens_granted: pkg.token_amount + pkg.bonus_tokens,
        created_by: user.id,
      })
      .select()
      .single();

    if (payError) {
      return new Response(JSON.stringify({ error: payError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // TODO: Integrate with payment gateway (PIX, Card, Boleto)
    // For now, simulate immediate approval for development
    const totalTokens = pkg.token_amount + pkg.bonus_tokens;

    // Add tokens via RPC
    const { error: addError } = await supabase.rpc("add_tokens", {
      p_tenant_id: tenantUser.tenant_id,
      p_amount: totalTokens,
      p_transaction_type: "purchase",
      p_description: `Compra do pacote ${pkg.name} (${pkg.token_amount} + ${pkg.bonus_tokens} bônus)`,
      p_reference_id: payment.id,
      p_metadata: { package_id: pkg.id, payment_method },
    });

    if (addError) {
      return new Response(JSON.stringify({ error: addError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update payment to completed
    await supabase
      .from("payment_records")
      .update({ status: "completed", paid_at: new Date().toISOString() })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        tokens_granted: totalTokens,
        message: "Tokens creditados com sucesso!",
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
