import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Validar JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return jsonResponse({ error: "Unauthorized" }, 401);

    const userId = claims.claims.sub as string;

    // 2. Validar Super Admin
    const { data: isSA, error: saErr } = await supabaseAdmin.rpc("is_super_admin", { _user_id: userId });
    if (saErr || !isSA) {
      return jsonResponse({ error: "Forbidden — apenas Super Admin" }, 403);
    }

    const { action, ...payload } = await req.json();
    if (!action) return jsonResponse({ error: "action é obrigatório" }, 400);

    // 3. Carregar conta ativa
    const { data: account, error: accErr } = await supabaseAdmin
      .from("platform_billing_accounts")
      .select("*")
      .eq("provider", "asaas")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accErr || !account) {
      return jsonResponse({ error: "Conta de cobrança da plataforma não configurada" }, 404);
    }

    const environment = account.environment as string;
    const apiKey =
      environment === "production"
        ? Deno.env.get("ASAAS_PLATFORM_API_KEY_PRODUCTION")
        : Deno.env.get("ASAAS_PLATFORM_API_KEY_SANDBOX");
    const baseUrl =
      environment === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";

    if (!apiKey) {
      return jsonResponse(
        { error: `Chave da API Asaas (Plataforma) não configurada para ambiente ${environment}` },
        500
      );
    }

    const asaasFetch = async (path: string, method = "GET", body?: any) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
          "User-Agent": "RivoConnect-Platform",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      return { status: res.status, body: json };
    };

    let result: any;
    let httpStatus = 200;

    switch (action) {
      case "ping": {
        // Healthcheck: lista 1 cobrança apenas para validar credenciais
        const r = await asaasFetch("/payments?limit=1");
        const ok = r.status >= 200 && r.status < 300;
        const message = ok
          ? `Conexão OK (${environment})`
          : r.body?.errors?.[0]?.description || `HTTP ${r.status}`;
        await supabaseAdmin
          .from("platform_billing_accounts")
          .update({
            last_test_at: new Date().toISOString(),
            last_test_status: ok ? "success" : "error",
            last_test_message: message,
          })
          .eq("id", account.id);
        result = { ok, environment, message, sample: r.body };
        httpStatus = ok ? 200 : 502;
        break;
      }

      case "create_customer": {
        const r = await asaasFetch("/customers", "POST", {
          name: payload.name,
          email: payload.email,
          cpfCnpj: payload.cpfCnpj,
          phone: payload.phone,
          externalReference: payload.externalReference, // tenant_id
        });
        result = r.body;
        httpStatus = r.status;
        break;
      }

      case "create_payment": {
        const r = await asaasFetch("/payments", "POST", {
          customer: payload.customer,
          billingType: payload.billingType,
          value: payload.value,
          dueDate: payload.dueDate,
          description: payload.description,
          externalReference: payload.externalReference,
          ...(account.wallet_id && payload.split !== false
            ? {} // futuro: split
            : {}),
          ...(payload.creditCard ? { creditCard: payload.creditCard } : {}),
          ...(payload.creditCardHolderInfo ? { creditCardHolderInfo: payload.creditCardHolderInfo } : {}),
        });
        result = r.body;
        httpStatus = r.status;
        break;
      }

      case "get_payment": {
        const r = await asaasFetch(`/payments/${payload.paymentId}`);
        result = r.body;
        httpStatus = r.status;
        break;
      }

      case "get_pix_qrcode": {
        const r = await asaasFetch(`/payments/${payload.paymentId}/pixQrCode`);
        result = r.body;
        httpStatus = r.status;
        break;
      }

      case "list_payments": {
        const params = new URLSearchParams();
        if (payload.limit) params.set("limit", String(payload.limit));
        if (payload.offset) params.set("offset", String(payload.offset));
        if (payload.status) params.set("status", payload.status);
        const r = await asaasFetch(`/payments?${params.toString()}`);
        result = r.body;
        httpStatus = r.status;
        break;
      }

      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }

    return jsonResponse(result, httpStatus);
  } catch (err: any) {
    console.error("[asaas-platform-proxy] error:", err);
    return jsonResponse({ error: err?.message || "Erro inesperado" }, 500);
  }
});
