import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NEGOCIARIE_BASE = "https://sistema.negociarie.com.br/api/v2";
const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";

// Simple in-memory token cache
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

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao autenticar na Negociarie: ${res.status} - ${txt}`);
  }

  const data = await res.json();
  cachedToken = data.access_token || data.token;
  if (!cachedToken) throw new Error("Token não retornado pela API Negociarie");
  // Cache for 50 minutes (tokens usually last 60 min)
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken;
}

async function negociarieRequest(method: string, endpoint: string, body?: unknown) {
  const token = await getToken();
  const url = `${NEGOCIARIE_BASE}${endpoint}`;
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
    const bodyStr = JSON.stringify(body);
    console.log(`[negociarie-proxy] ${method} ${endpoint} payload:`, bodyStr);
    opts.body = bodyStr;
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    console.error(`[negociarie-proxy] API error ${res.status}:`, JSON.stringify(json));
    throw new Error(json.message || json.error || JSON.stringify(json.errors || json) || `Negociarie ${res.status}`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action, ...params } = body;
    console.log(`[negociarie-proxy] action=${action} user=${user.id}`);

    let result;

    switch (action) {
      case "test-connection": {
        // Try to authenticate with Negociarie - if getToken succeeds, we're connected
        await getToken();
        result = { connected: true, status: 200 };
        break;
      }

      case "nova-cobranca": {
        result = await negociarieRequest("POST", "/cobranca/nova", params.data);
        break;
      }

      case "nova-pix": {
        result = await negociarieRequest("POST", "/cobranca/nova-pix", params.data);
        break;
      }

      case "nova-cartao": {
        result = await negociarieRequest("POST", "/cobranca/nova-cartao", params.data);
        break;
      }

      case "consulta-cobrancas": {
        const qs = new URLSearchParams();
        if (params.cpf) qs.set("cpf", params.cpf);
        if (params.id_geral) qs.set("id_geral", params.id_geral);
        if (params.limit) qs.set("limit", String(params.limit));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        result = await negociarieRequest("GET", `/cobranca/consulta${query}`);
        break;
      }

      case "baixa-manual": {
        result = await negociarieRequest("POST", "/cobranca/baixa-manual", params.data);
        break;
      }

      case "parcelas-pagas": {
        const data = params.data || new Date().toISOString().split("T")[0];
        result = await negociarieRequest("GET", `/cobranca/parcelas-pagas?data=${data}`);
        break;
      }

      case "alteradas-hoje": {
        result = await negociarieRequest("GET", "/cobranca/alteradas-hoje");
        break;
      }

      case "atualizar-callback": {
        result = await negociarieRequest("POST", "/cobranca/atualizar-url-callback", params.data);
        break;
      }

      case "pagamento-credito": {
        result = await negociarieRequest("POST", "/cobranca/pagamento-credito", params.data);
        break;
      }

      case "cancelar-pagamento": {
        result = await negociarieRequest("PATCH", "/cobranca/pagamento-credito/cancelar", params.data);
        break;
      }

      case "inadimplencia-nova": {
        result = await negociarieRequest("POST", "/inadimplencia/nova", params.data);
        break;
      }

      case "inadimplencia-titulos": {
        const qs = new URLSearchParams();
        if (params.cpf) qs.set("cpf", params.cpf);
        const query = qs.toString() ? `?${qs.toString()}` : "";
        result = await negociarieRequest("GET", `/inadimplencia/titulos${query}`);
        break;
      }

      case "inadimplencia-acordos": {
        result = await negociarieRequest("GET", "/inadimplencia/acordos");
        break;
      }

      case "inadimplencia-baixa-parcela": {
        result = await negociarieRequest("POST", "/inadimplencia/baixa-parcela", params.data);
        break;
      }

      case "inadimplencia-devolucao": {
        result = await negociarieRequest("POST", "/inadimplencia/devolucao-titulo", params.data);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[negociarie-proxy] ERROR: ${e.message}`);
    // Reset token on auth errors
    if (e.message?.includes("401") || e.message?.includes("autenticar")) {
      cachedToken = null;
      tokenExpiry = 0;
    }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
