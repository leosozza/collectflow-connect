import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status: number, details?: string) {
  console.error(JSON.stringify({ step: "error_response", code, message, details }));
  return jsonResponse({ error: message, code, details }, status);
}

function log(step: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({ step, ...data }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Authenticate caller ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("NO_AUTH_HEADER", "Authorization header missing", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Validate caller token using admin client (more resilient than anon+header)
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !callerUser) {
      log("auth_caller_failed", { error: userError?.message });
      return errorResponse("SESSION_EXPIRED", "Sessão expirada. Faça logout e login novamente.", 401);
    }

    const callerId = callerUser.id;
    log("auth_caller", { callerId, email: callerUser.email });

    // ── Resolve caller tenant ──
    const { data: callerTenantUser } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", callerId)
      .single();

    if (!callerTenantUser) {
      return errorResponse("NO_TENANT", "Caller não possui tenant vinculado", 403);
    }

    const callerRole = callerTenantUser.role;
    const allowedRoles = ["admin", "super_admin"];
    if (!allowedRoles.includes(callerRole)) {
      return errorResponse("FORBIDDEN", "Apenas admins podem gerenciar usuários", 403);
    }

    log("tenant_resolved", { tenantId: callerTenantUser.tenant_id, callerRole });

    const body = await req.json();
    const { action } = body;

    // Determine effective tenant_id
    // Super admin can target a different tenant via body.tenant_id
    const effectiveTenantId =
      callerRole === "super_admin" && body.tenant_id
        ? body.tenant_id
        : callerTenantUser.tenant_id;

    // ══════════════════════════════════════════════
    // ── DELETE USER ──
    // ══════════════════════════════════════════════
    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return errorResponse("VALIDATION_ERROR", "user_id é obrigatório", 400);
      }

      log("delete_user_start", { user_id });

      // Verify target belongs to caller's tenant (or is orphan)
      const { data: targetTU } = await supabaseAdmin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (targetTU && targetTU.tenant_id !== effectiveTenantId) {
        return errorResponse("TENANT_CONFLICT", "Usuário não pertence ao seu tenant", 404);
      }

      // Get profile_id for cascading deletes
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (profile?.id) {
        await supabaseAdmin.from("operator_instances").delete().eq("profile_id", profile.id);
        await supabaseAdmin.from("user_permissions").delete().eq("profile_id", profile.id);
        log("delete_cascading", { profile_id: profile.id });
      }

      await supabaseAdmin.from("invite_links").delete().eq("created_by", user_id);
      await supabaseAdmin.from("invite_links").delete().eq("used_by", user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("tenant_users").delete().eq("user_id", user_id);

      const { error: authDelError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (authDelError) {
        log("delete_auth_warning", { error: authDelError.message });
      }

      log("delete_user_done", { user_id });
      return jsonResponse({ success: true, code: "USER_DELETED" });
    }

    // ══════════════════════════════════════════════
    // ── UPDATE PASSWORD ──
    // ══════════════════════════════════════════════
    if (action === "update_password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return errorResponse("VALIDATION_ERROR", "user_id e password são obrigatórios", 400);
      }
      if (password.length < 6) {
        return errorResponse("VALIDATION_ERROR", "Senha deve ter pelo menos 6 caracteres", 400);
      }

      const { data: targetTU } = await supabaseAdmin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user_id)
        .single();

      if (!targetTU || targetTU.tenant_id !== effectiveTenantId) {
        return errorResponse("TENANT_CONFLICT", "Usuário não encontrado no seu tenant", 404);
      }

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (pwError) {
        return errorResponse("PASSWORD_UPDATE_FAILED", pwError.message, 400);
      }

      log("password_updated", { user_id });
      return jsonResponse({ success: true, code: "PASSWORD_UPDATED" });
    }

    // ══════════════════════════════════════════════
    // ── CREATE USER (idempotent) ──
    // ══════════════════════════════════════════════
    const {
      full_name,
      email: rawEmail,
      password,
      role = "operador",
      cpf = null,
      phone = null,
      permission_profile_id = null,
      commission_grade_id = null,
      threecplus_agent_id = null,
      instance_ids = [],
    } = body;

    if (!full_name || !rawEmail || !password) {
      return errorResponse("VALIDATION_ERROR", "full_name, email e password são obrigatórios", 400);
    }
    if (password.length < 6) {
      return errorResponse("VALIDATION_ERROR", "Senha deve ter pelo menos 6 caracteres", 400);
    }

    const email = rawEmail.trim().toLowerCase();
    log("create_user_start", { email, role, targetTenant: effectiveTenantId });

    let newUserId: string | undefined;
    let wasCreatedHere = false;
    let wasReused = false;

    // Step 1: Try to create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      const msg = authError.message?.toLowerCase() || "";
      const isAlreadyExists =
        msg.includes("already") || msg.includes("registered") || msg.includes("exists");

      if (!isAlreadyExists) {
        return errorResponse("AUTH_CREATE_FAILED", authError.message, 400);
      }

      log("auth_user_exists", { email });

      // Find existing user by email (admin API - no pagination issue)
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const existingUser = listData?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === email
      );

      if (!existingUser) {
        return errorResponse(
          "AUTH_CONFLICT",
          "Email registrado mas usuário não encontrado. Contate o suporte.",
          409
        );
      }

      // Check tenant ownership
      const { data: existingTU } = await supabaseAdmin
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingTU && existingTU.tenant_id !== effectiveTenantId) {
        return errorResponse(
          "TENANT_CONFLICT",
          "Usuário já pertence a outra empresa",
          409,
          `O email ${email} já está vinculado a outro tenant.`
        );
      }

      // If same tenant, update credentials and proceed (idempotent)
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      newUserId = existingUser.id;
      wasReused = true;
      log("auth_user_reused", { newUserId });
    } else {
      newUserId = authData.user.id;
      wasCreatedHere = true;
      log("auth_user_created", { newUserId });
    }

    // Step 2: Upsert tenant_users
    const { error: tuError } = await supabaseAdmin
      .from("tenant_users")
      .upsert(
        { tenant_id: effectiveTenantId, user_id: newUserId, role },
        { onConflict: "user_id" }
      );

    if (tuError) {
      log("tenant_users_failed", { error: tuError.message });
      if (wasCreatedHere) await supabaseAdmin.auth.admin.deleteUser(newUserId!);
      return errorResponse("TENANT_USERS_FAILED", tuError.message, 500, "Falha ao vincular tenant_users");
    }
    log("tenant_users_ok", { tenantId: effectiveTenantId });

    // Step 3: Upsert profile (use the role from body, not hardcoded)
    const profileUpsert: Record<string, unknown> = {
      user_id: newUserId,
      full_name,
      tenant_id: effectiveTenantId,
      role,
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
      log("profile_failed", { error: profileError.message });
      if (wasCreatedHere) await supabaseAdmin.auth.admin.deleteUser(newUserId!);
      return errorResponse("PROFILE_FAILED", profileError.message, 500, "Falha ao criar/atualizar profile");
    }
    log("profile_ok", { profileId: profileData?.id });

    // Step 4: Assign WhatsApp instances
    if (instance_ids.length > 0 && profileData?.id) {
      // Clear old instances first (idempotent)
      await supabaseAdmin.from("operator_instances").delete().eq("profile_id", profileData.id);
      const rows = instance_ids.map((instId: string) => ({
        profile_id: profileData.id,
        instance_id: instId,
        tenant_id: effectiveTenantId,
      }));
      await supabaseAdmin.from("operator_instances").insert(rows);
      log("instances_assigned", { count: instance_ids.length });
    }

    const resultCode = wasReused ? "USER_REUSED" : "USER_CREATED";
    log("create_user_done", { code: resultCode, newUserId });

    return jsonResponse({
      success: true,
      code: resultCode,
      user_id: newUserId,
      profile_id: profileData?.id,
      message: wasReused
        ? "Usuário existente reaproveitado e atualizado com sucesso"
        : "Usuário criado com sucesso",
    });
  } catch (err) {
    console.error("create-user unhandled:", err);
    return errorResponse("INTERNAL", "Erro interno do servidor", 500, String(err));
  }
});
