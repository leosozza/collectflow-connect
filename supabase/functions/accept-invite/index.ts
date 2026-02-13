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
    const { token, user_id } = await req.json();

    if (!token || !user_id) {
      return new Response(
        JSON.stringify({ error: "token and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch invite
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("invite_links")
      .select("*")
      .eq("token", token)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: "Convite inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into tenant_users
    const { error: tuErr } = await supabaseAdmin
      .from("tenant_users")
      .insert({
        tenant_id: invite.tenant_id,
        user_id,
        role: invite.role,
      });

    if (tuErr && !tuErr.message?.includes("duplicate")) {
      throw tuErr;
    }

    // Update profile with tenant_id
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ tenant_id: invite.tenant_id })
      .eq("user_id", user_id);

    if (profErr) throw profErr;

    // Mark invite as used
    await supabaseAdmin
      .from("invite_links")
      .update({ used_by: user_id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ success: true, tenant_id: invite.tenant_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("accept-invite error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao aceitar convite" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
