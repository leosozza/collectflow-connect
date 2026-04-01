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

    const { data: { user: callerUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerUser.id;

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
    const { action } = body;

    // ── Update password flow ──
    if (action === "update_password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: "user_id and password are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetTU } = await supabaseAdmin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user_id)
        .single();

      if (!targetTU || targetTU.tenant_id !== tenantId) {
        return new Response(JSON.stringify({ error: "User not found in your tenant" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (pwError) {
        return new Response(JSON.stringify({ error: pwError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Create user flow (existing) ──
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
    let newUserId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      // If email already exists, try to reuse the orphaned auth user
      if (authError.message?.toLowerCase().includes("already") || authError.message?.toLowerCase().includes("registered") || authError.message?.toLowerCase().includes("exists")) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = listData?.users?.find((u: { email?: string }) => u.email === email);
        if (!existingUser) {
          return new Response(JSON.stringify({ error: "Email conflict but user not found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Ensure user doesn't belong to another tenant
        const { data: existingTU } = await supabaseAdmin
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", existingUser.id)
          .maybeSingle();

        if (existingTU && existingTU.tenant_id !== tenantId) {
          return new Response(JSON.stringify({ error: "User already belongs to another tenant" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update password and metadata for the reused user
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

        newUserId = existingUser.id;
        console.log(`Reusing existing auth user ${newUserId} for email ${email}`);
      } else {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      newUserId = authData.user.id;
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

    // Upsert profile — covers cases where the trigger failed (invite flow, etc.)
    const profileUpsert: Record<string, unknown> = {
      user_id: newUserId,
      full_name,
      tenant_id: tenantId,
      role: "operador", // app_role - operador is the base for profile table
    };
    if (cpf) profileUpsert.cpf = cpf;
    if (phone) profileUpsert.phone = phone;
    if (commission_grade_id) profileUpsert.commission_grade_id = commission_grade_id;
    if (threecplus_agent_id) profileUpsert.threecplus_agent_id = threecplus_agent_id;
    if (permission_profile_id) profileUpsert.permission_profile_id = permission_profile_id;

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileUpsert, { onConflict: "user_id" })
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
