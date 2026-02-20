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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create caller client to verify admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get caller's tenant and verify they are admin
    const { data: callerTenantUser } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", callerId)
      .single();

    if (!callerTenantUser) {
      return new Response(JSON.stringify({ error: "Caller has no tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedRoles = ["admin", "super_admin"];
    if (!allowedRoles.includes(callerTenantUser.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: only admins can create users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = callerTenantUser.tenant_id;

    const body = await req.json();
    const {
      full_name,
      email,
      password,
      role = "operador",
      cpf = null,
      phone = null,
      permission_profile_id = null,
      commission_grade_id = null,
      threecplus_agent_id = null,
      instance_ids = [],
    } = body;

    if (!full_name || !email || !password) {
      return new Response(JSON.stringify({ error: "full_name, email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user in auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = authData.user.id;

    // Insert tenant_user record
    const { error: tuError } = await supabaseAdmin
      .from("tenant_users")
      .insert({ tenant_id: tenantId, user_id: newUserId, role });

    if (tuError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: tuError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile (auto-created by trigger) with full_name, tenant_id, role, permission_profile_id
    const profileUpdate: Record<string, unknown> = {
      full_name,
      tenant_id: tenantId,
      role: "operador", // app_role - operador is the base for profile table
    };
    if (cpf) profileUpdate.cpf = cpf;
    if (phone) profileUpdate.phone = phone;
    if (commission_grade_id) profileUpdate.commission_grade_id = commission_grade_id;
    if (threecplus_agent_id) profileUpdate.threecplus_agent_id = threecplus_agent_id;
    if (permission_profile_id) profileUpdate.permission_profile_id = permission_profile_id;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", newUserId)
      .select("id")
      .single();

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign WhatsApp instances
    if (instance_ids.length > 0 && profileData?.id) {
      const rows = instance_ids.map((instId: string) => ({
        profile_id: profileData.id,
        instance_id: instId,
        tenant_id: tenantId,
      }));
      await supabaseAdmin.from("operator_instances").insert(rows);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId, profile_id: profileData?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-user error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
