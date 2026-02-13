import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NEGOCIARIE_BASE = "https://sistema.negociarie.com.br/api/v2";
const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const clientId = Deno.env.get("NEGOCIARIE_CLIENT_ID");
  const clientSecret = Deno.env.get("NEGOCIARIE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Credenciais Negociarie não configuradas");

  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Falha ao autenticar na Negociarie: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token || data.token;
  if (!cachedToken) throw new Error("Token não retornado");
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken;
}

async function negociarieRequest(method: string, endpoint: string, body?: unknown) {
  const token = await getToken();
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${NEGOCIARIE_BASE}${endpoint}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json.message || json.error || `Negociarie ${res.status}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, checkout_token, ...params } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!checkout_token || typeof checkout_token !== "string") {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch agreement by token
    const { data: agreement, error: agErr } = await supabase
      .from("agreements")
      .select("*")
      .eq("checkout_token", checkout_token)
      .single();

    if (agErr || !agreement) {
      return new Response(JSON.stringify({ error: "Acordo não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-agreement") {
      // Also fetch existing payments
      const { data: payments } = await supabase
        .from("portal_payments")
        .select("*")
        .eq("agreement_id", agreement.id)
        .order("created_at", { ascending: true });

      // Fetch tenant info
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, slug, logo_url, primary_color")
        .eq("id", agreement.tenant_id)
        .single();

      return new Response(JSON.stringify({ agreement, payments: payments || [], tenant }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-payment") {
      const { payment_method, amount } = params;

      if (!payment_method || !amount || amount <= 0) {
        return new Response(JSON.stringify({ error: "Método e valor obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate total doesn't exceed agreement
      const { data: existingPayments } = await supabase
        .from("portal_payments")
        .select("amount, status")
        .eq("agreement_id", agreement.id)
        .neq("status", "failed");

      const existingTotal = (existingPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      if (existingTotal + amount > agreement.proposed_total * 1.01) {
        return new Response(JSON.stringify({ error: "Valor excede o total do acordo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create charge via Negociarie
      const chargeData: Record<string, unknown> = {
        cpf: agreement.client_cpf,
        nome: agreement.client_name,
        valor: amount,
        vencimento: agreement.first_due_date,
      };

      let negResult: any;
      try {
        if (payment_method === "pix") {
          negResult = await negociarieRequest("POST", "/cobranca/nova-pix", chargeData);
        } else {
          negResult = await negociarieRequest("POST", "/cobranca/nova-cartao", chargeData);
        }
      } catch (e) {
        console.error("[portal-checkout] Negociarie error:", e.message);
        negResult = { error: e.message };
      }

      // Save payment record
      const { data: payment, error: insertErr } = await supabase
        .from("portal_payments")
        .insert({
          tenant_id: agreement.tenant_id,
          agreement_id: agreement.id,
          payment_method,
          amount,
          status: negResult.error ? "failed" : "processing",
          negociarie_id_geral: negResult.id_geral || negResult.data?.id_geral || null,
          payment_data: negResult,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ payment, negociarie: negResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "payment-status") {
      const { data: payments } = await supabase
        .from("portal_payments")
        .select("*")
        .eq("agreement_id", agreement.id)
        .order("created_at", { ascending: true });

      return new Response(JSON.stringify({ payments: payments || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[portal-checkout] ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
