import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tryLogin(clientId: string, clientSecret: string) {
  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    });
    const text = await res.text();
    const isHtml = text.trim().startsWith("<!") || text.includes("<html");
    if (!res.ok) {
      const msg = isHtml
        ? `Servidor Negociarie indisponível (status ${res.status})`
        : `Negociarie respondeu ${res.status}: ${text.substring(0, 200)}`;
      return { ok: false, message: msg };
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, message: "Resposta inválida da Negociarie" };
    }
    const token = parsed.access_token || parsed.token;
    if (!token) {
      return { ok: false, message: "Token não retornado pela Negociarie" };
    }
    return { ok: true, message: "Conexão validada com sucesso" };
  } catch (e: any) {
    return { ok: false, message: `Falha de rede: ${e.message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing Authorization" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente do usuário (pra validar JWT e role)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Sessão inválida" });
    const userId = userData.user.id;

    // Cliente service-role (pra ler/gravar a tabela protegida)
    const admin = createClient(supabaseUrl, serviceKey);

    // Tenant + role
    const { data: tu } = await admin
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!tu?.tenant_id) return json(403, { error: "Tenant não localizado" });
    const tenantId = tu.tenant_id as string;

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    // Super admin (can_access_tenant retorna true em qualquer tenant) também passa
    const { data: isSuperAdmin } = await admin.rpc("is_super_admin", { _user_id: userId });

    if (profile?.role !== "admin" && !isSuperAdmin) {
      return json(403, { error: "Apenas administradores podem alterar integrações" });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const creditorId: string | null = body?.creditor_id ?? null;
    const provider = "negociarie";

    // Resolve tenant alvo (super admin pode operar em outros tenants via can_access_tenant)
    const requestedTenantId: string | null = body?.tenant_id ?? null;
    let targetTenantId = tenantId;
    if (requestedTenantId && requestedTenantId !== tenantId) {
      const { data: canAccess, error: caErr } = await admin.rpc("can_access_tenant", {
        _tenant_id: requestedTenantId,
      });
      if (caErr || !canAccess) {
        return json(403, { error: "Sem permissão para gerenciar este tenant" });
      }
      targetTenantId = requestedTenantId;
    }

    // Carrega linha existente
    const baseQuery = admin
      .from("tenant_integrations")
      .select("id, config, is_active, last_test_at, last_test_ok, last_test_message, callback_registered_at")
      .eq("tenant_id", targetTenantId)
      .eq("provider", provider);
    const { data: existing } = creditorId
      ? await baseQuery.eq("creditor_id", creditorId).maybeSingle()
      : await baseQuery.is("creditor_id", null).maybeSingle();

    if (action === "get_status") {
      const cfg = (existing?.config as any) || {};
      const rawId: string = cfg.client_id || "";
      const masked = rawId
        ? rawId.length > 8
          ? `${rawId.substring(0, 4)}••••${rawId.substring(rawId.length - 4)}`
          : "••••"
        : "";
      return json(200, {
        configured: !!existing,
        has_credentials: !!(cfg.client_id && cfg.client_secret),
        uses_global_fallback: cfg.uses_global_fallback === true,
        client_id_masked: masked,
        is_active: existing?.is_active ?? false,
        last_test_at: existing?.last_test_at ?? null,
        last_test_ok: existing?.last_test_ok ?? null,
        last_test_message: existing?.last_test_message ?? null,
        callback_registered_at: existing?.callback_registered_at ?? null,
      });
    }

    if (action === "save") {
      const clientIdInput = String(body?.client_id || "").trim();
      let clientSecretInput = String(body?.client_secret || "").trim();

      if (!clientIdInput) return json(400, { error: "client_id é obrigatório" });

      // Se o secret veio vazio e já existe linha com secret, mantemos o anterior
      if (!clientSecretInput) {
        const prev = (existing?.config as any)?.client_secret;
        if (!prev) return json(400, { error: "client_secret é obrigatório" });
        clientSecretInput = prev;
      }

      const test = await tryLogin(clientIdInput, clientSecretInput);
      if (!test.ok) return json(400, { error: test.message });

      const prevConfig = (existing?.config as any) || {};
      const newConfig = {
        ...prevConfig,
        client_id: clientIdInput,
        client_secret: clientSecretInput,
      };
      delete (newConfig as any).uses_global_fallback;

      const payload = {
        tenant_id: targetTenantId,
        creditor_id: creditorId,
        provider,
        is_active: true,
        config: newConfig,
        last_test_at: new Date().toISOString(),
        last_test_ok: true,
        last_test_message: test.message,
        created_by: userId,
      };

      if (existing?.id) {
        const { error } = await admin
          .from("tenant_integrations")
          .update(payload)
          .eq("id", existing.id);
        if (error) return json(500, { error: error.message });
      } else {
        const { error } = await admin.from("tenant_integrations").insert(payload);
        if (error) return json(500, { error: error.message });
      }
      return json(200, { ok: true, message: test.message });
    }

    if (action === "test") {
      const cfg = (existing?.config as any) || {};
      let clientId = cfg.client_id;
      let clientSecret = cfg.client_secret;
      if (cfg.uses_global_fallback || !clientId || !clientSecret) {
        clientId = Deno.env.get("NEGOCIARIE_CLIENT_ID");
        clientSecret = Deno.env.get("NEGOCIARIE_CLIENT_SECRET");
      }
      if (!clientId || !clientSecret) {
        return json(400, { error: "Credenciais não configuradas" });
      }
      const test = await tryLogin(clientId, clientSecret);
      if (existing?.id) {
        await admin
          .from("tenant_integrations")
          .update({
            last_test_at: new Date().toISOString(),
            last_test_ok: test.ok,
            last_test_message: test.message,
          })
          .eq("id", existing.id);
      }
      return json(test.ok ? 200 : 400, { ok: test.ok, message: test.message });
    }

    if (action === "delete") {
      if (!existing?.id) return json(200, { ok: true });
      const cfg = (existing.config as any) || {};
      // Preserva flag de fallback global pra Y.BRASIL não regredir
      const newConfig = cfg.uses_global_fallback
        ? { uses_global_fallback: true }
        : {};
      const { error } = await admin
        .from("tenant_integrations")
        .update({
          is_active: cfg.uses_global_fallback === true,
          config: newConfig,
          last_test_at: null,
          last_test_ok: null,
          last_test_message: "Credenciais removidas",
        })
        .eq("id", existing.id);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    return json(400, { error: `Ação desconhecida: ${action}` });
  } catch (e: any) {
    console.error("[negociarie-credentials] error:", e?.message);
    return json(500, { error: e?.message || "Erro interno" });
  }
});
