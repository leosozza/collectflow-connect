import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAsaasConfig(supabase: any) {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "asaas_environment")
    .single();

  const environment = data?.value || "sandbox";

  const apiKey = environment === "production"
    ? Deno.env.get("ASAAS_API_KEY_PRODUCTION")
    : Deno.env.get("ASAAS_API_KEY_SANDBOX");

  const baseUrl = environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

  return { apiKey, baseUrl, environment };
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

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();
    const { apiKey, baseUrl } = await getAsaasConfig(supabaseAdmin);

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Chave da API Asaas não configurada para o ambiente selecionado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const asaasFetch = async (path: string, method = "GET", body?: any) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return res.json();
    };

    let result: any;

    switch (action) {
      case "create_customer": {
        result = await asaasFetch("/customers", "POST", {
          name: payload.name,
          email: payload.email,
          cpfCnpj: payload.cpfCnpj,
          phone: payload.phone,
        });
        break;
      }

      case "create_payment": {
        result = await asaasFetch("/payments", "POST", {
          customer: payload.customer,
          billingType: payload.billingType,
          value: payload.value,
          dueDate: payload.dueDate,
          description: payload.description,
          ...(payload.creditCard ? { creditCard: payload.creditCard } : {}),
          ...(payload.creditCardHolderInfo ? { creditCardHolderInfo: payload.creditCardHolderInfo } : {}),
        });
        break;
      }

      case "get_payment": {
        result = await asaasFetch(`/payments/${payload.paymentId}`);
        break;
      }

      case "get_pix_qrcode": {
        result = await asaasFetch(`/payments/${payload.paymentId}/pixQrCode`);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
