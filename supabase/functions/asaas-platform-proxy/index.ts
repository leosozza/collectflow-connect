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

const BILLING_TYPES = new Set(["BOLETO", "PIX", "CREDIT_CARD", "UNDEFINED"]);
const CYCLES = new Set(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUALLY", "YEARLY"]);

const onlyDigits = (value?: string | null) => String(value || "").replace(/\D/g, "");

const isDateOnly = (value?: string | null) =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const asaasError = (body: any, fallback: string) =>
  body?.errors?.[0]?.description || body?.error || fallback;

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
        : "https://api-sandbox.asaas.com/v3";

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
      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { raw: text };
      }
      return { status: res.status, body: json };
    };

    const ensurePlatformCustomer = async (tenant: any) => {
      const cpfCnpj = onlyDigits(payload.cpfCnpj || tenant.cnpj);
      if (![11, 14].includes(cpfCnpj.length)) {
        return {
          ok: false,
          status: 400,
          body: { error: "Informe um CPF/CNPJ valido para criar o cliente no Asaas" },
        };
      }

      const customerPayload = {
        name: payload.customerName || tenant.name,
        cpfCnpj,
        email: payload.email || undefined,
        phone: onlyDigits(payload.phone) || undefined,
        externalReference: `tenant:${tenant.id}`,
      };

      const { data: existingCustomer } = await supabaseAdmin
        .from("platform_billing_customers")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("platform_account_id", account.id)
        .maybeSingle();

      let asaasCustomer = null;
      let asaasCustomerId = existingCustomer?.asaas_customer_id as string | undefined;

      if (asaasCustomerId) {
        const update = await asaasFetch(`/customers/${asaasCustomerId}`, "PUT", customerPayload);
        if (update.status >= 200 && update.status < 300 && !update.body?.errors) {
          asaasCustomer = update.body;
        } else if (update.status !== 404) {
          return {
            ok: false,
            status: update.status,
            body: { error: asaasError(update.body, "Erro ao atualizar cliente Asaas"), details: update.body },
          };
        } else {
          asaasCustomerId = undefined;
        }
      }

      if (!asaasCustomerId) {
        const create = await asaasFetch("/customers", "POST", customerPayload);
        if (create.status < 200 || create.status >= 300 || create.body?.errors) {
          return {
            ok: false,
            status: create.status,
            body: { error: asaasError(create.body, "Erro ao criar cliente Asaas"), details: create.body },
          };
        }
        asaasCustomer = create.body;
        asaasCustomerId = create.body.id;
      }

      const { data: savedCustomer, error: saveCustomerErr } = await supabaseAdmin
        .from("platform_billing_customers")
        .upsert(
          {
            tenant_id: tenant.id,
            platform_account_id: account.id,
            asaas_customer_id: asaasCustomerId,
            name: customerPayload.name,
            cpf_cnpj: cpfCnpj,
            email: payload.email || null,
            phone: onlyDigits(payload.phone) || null,
            raw_response: asaasCustomer || {},
            created_by: userId,
          },
          { onConflict: "tenant_id,platform_account_id" }
        )
        .select("*")
        .single();

      if (saveCustomerErr) {
        return {
          ok: false,
          status: 500,
          body: { error: "Cliente criado no Asaas, mas nao foi salvo no banco", details: saveCustomerErr.message },
        };
      }

      return { ok: true, status: 200, body: savedCustomer };
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

      case "create_subscription": {
        const r = await asaasFetch("/subscriptions", "POST", {
          customer: payload.customer,
          billingType: payload.billingType,
          value: payload.value,
          nextDueDate: payload.nextDueDate,
          cycle: payload.cycle,
          description: payload.description,
          externalReference: payload.externalReference,
        });
        result = r.body;
        httpStatus = r.status;
        break;
      }

      case "create_tenant_subscription": {
        const tenantId = payload.tenantId || payload.tenant_id;
        if (!tenantId) return jsonResponse({ error: "tenantId e obrigatorio" }, 400);

        const billingType = payload.billingType || "BOLETO";
        const cycle = payload.cycle || "MONTHLY";
        if (!BILLING_TYPES.has(billingType)) {
          return jsonResponse({ error: "Forma de pagamento invalida" }, 400);
        }
        if (!CYCLES.has(cycle)) {
          return jsonResponse({ error: "Periodicidade invalida" }, 400);
        }
        if (!isDateOnly(payload.nextDueDate)) {
          return jsonResponse({ error: "Data de vencimento inicial invalida" }, 400);
        }

        const { data: tenant, error: tenantErr } = await supabaseAdmin
          .from("tenants")
          .select("id, name, slug, cnpj, plan_id")
          .eq("id", tenantId)
          .maybeSingle();
        if (tenantErr || !tenant) {
          return jsonResponse({ error: "Tenant nao encontrado" }, 404);
        }

        const planId = payload.planId || payload.plan_id || tenant.plan_id;
        let plan: any = null;
        if (planId) {
          const { data: planData } = await supabaseAdmin
            .from("plans")
            .select("id, name, price_monthly")
            .eq("id", planId)
            .maybeSingle();
          plan = planData;
        }

        const value = Number(payload.value ?? plan?.price_monthly);
        if (!Number.isFinite(value) || value <= 0) {
          return jsonResponse({ error: "Valor da assinatura deve ser maior que zero" }, 400);
        }

        const { data: activeSubscription } = await supabaseAdmin
          .from("platform_billing_subscriptions")
          .select("id, asaas_subscription_id, status")
          .eq("tenant_id", tenant.id)
          .eq("platform_account_id", account.id)
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (activeSubscription && !payload.force) {
          return jsonResponse(
            {
              error: `Este tenant ja possui assinatura ativa no Asaas (${activeSubscription.asaas_subscription_id})`,
              subscription: activeSubscription,
            },
            409
          );
        }

        const customerResult = await ensurePlatformCustomer(tenant);
        if (!customerResult.ok) return jsonResponse(customerResult.body, customerResult.status);
        const customer = customerResult.body;

        const externalReference = payload.externalReference || `tenant:${tenant.id}`;
        const description =
          payload.description ||
          `Assinatura Rivo Connect - ${tenant.name}${plan?.name ? ` - ${plan.name}` : ""}`;

        const subscriptionPayload = {
          customer: customer.asaas_customer_id,
          billingType,
          value,
          nextDueDate: payload.nextDueDate,
          cycle,
          description,
          externalReference,
        };

        const created = await asaasFetch("/subscriptions", "POST", subscriptionPayload);
        if (created.status < 200 || created.status >= 300 || created.body?.errors) {
          return jsonResponse(
            { error: asaasError(created.body, "Erro ao criar assinatura Asaas"), details: created.body },
            created.status
          );
        }

        const { data: savedSubscription, error: saveSubErr } = await supabaseAdmin
          .from("platform_billing_subscriptions")
          .insert({
            tenant_id: tenant.id,
            plan_id: planId || null,
            platform_account_id: account.id,
            platform_customer_id: customer.id,
            asaas_subscription_id: created.body.id,
            billing_type: billingType,
            cycle,
            value,
            next_due_date: payload.nextDueDate,
            status: created.body.status || "ACTIVE",
            description,
            external_reference: externalReference,
            raw_response: created.body,
            created_by: userId,
          })
          .select("*")
          .single();

        if (saveSubErr) {
          return jsonResponse(
            {
              error: "Assinatura criada no Asaas, mas nao foi registrada no banco",
              details: saveSubErr.message,
              asaas_subscription: created.body,
            },
            500
          );
        }

        const payments = await asaasFetch(`/subscriptions/${created.body.id}/payments?limit=5`);
        result = {
          environment,
          customer,
          subscription: savedSubscription,
          asaas_subscription: created.body,
          payments: payments.status >= 200 && payments.status < 300 ? payments.body : null,
        };
        httpStatus = 200;
        break;
      }

      case "get_payment": {
        const r = await asaasFetch(`/payments/${payload.paymentId}`);
        result = r.body;
        httpStatus = r.status;
        break;
      }

      case "get_subscription_payments": {
        const params = new URLSearchParams();
        if (payload.status) params.set("status", payload.status);
        if (payload.limit) params.set("limit", String(payload.limit));
        const query = params.toString();
        const r = await asaasFetch(`/subscriptions/${payload.subscriptionId}/payments${query ? `?${query}` : ""}`);
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
