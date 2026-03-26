import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  if (!res.ok) {
    const txt = await res.text();
    const isHtml = txt.trim().startsWith("<!") || txt.includes("<html");
    const msg = isHtml
      ? `Servidor Negociarie indisponível (status ${res.status}). Tente novamente em alguns minutos.`
      : `Falha ao autenticar na Negociarie: ${res.status} - ${txt.substring(0, 200)}`;
    throw new Error(msg);
  }

  const data = await res.json();
  cachedToken = data.access_token || data.token;
  if (!cachedToken) throw new Error("Token não retornado pela API Negociarie");
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
  const isHtml = text.trim().startsWith("<!") || text.includes("<html");

  if (isHtml) {
    const preview = text.substring(0, 500);
    console.error(`[negociarie-proxy] API returned HTML (${res.status}):`, preview);
    if (!res.ok) throw new Error(`Negociarie retornou erro ${res.status}. Resposta: ${preview.substring(0, 200)}`);
    json = { raw: "HTML response" };
  } else {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      console.error(`[negociarie-proxy] API error ${res.status}:`, JSON.stringify(json));
      throw new Error(json.message || json.error || JSON.stringify(json.errors || json) || `Negociarie ${res.status}`);
    }
  }

  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("[negociarie-proxy] Auth error:", claimsError?.message);
      return new Response(JSON.stringify({ error: "Token inválido. Faça login novamente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { action, ...params } = body;
    console.log(`[negociarie-proxy] action=${action} user=${userId}`);

    let result;

    switch (action) {
      case "test-connection": {
        await getToken();
        result = { connected: true, status: 200 };
        break;
      }

      case "nova-cobranca": {
        const cobrancaData = (params.data as Record<string, unknown>) || {};
        const devedorObj =
          (cobrancaData.devedor as Record<string, unknown> | undefined) ??
          (cobrancaData.cliente as Record<string, unknown> | undefined);

        if (devedorObj) {
          if (devedorObj.documento) {
            devedorObj.documento = String(devedorObj.documento).replace(/\D/g, "");
          }
          if (devedorObj.cep) {
            const cepDigits = String(devedorObj.cep).replace(/\D/g, "");
            devedorObj.cep = cepDigits.length === 8
              ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`
              : devedorObj.cep;
          }
          if (devedorObj.uf) {
            devedorObj.uf = String(devedorObj.uf).trim().toUpperCase();
          }
          if (devedorObj.nome) {
            devedorObj.nome = String(devedorObj.nome).trim();
          }
          if (devedorObj.bairro) {
            devedorObj.bairro = String(devedorObj.bairro).trim();
          }
          if (devedorObj.endereco) {
            devedorObj.endereco = String(devedorObj.endereco).trim();
          }
          if (devedorObj.cidade) {
            devedorObj.cidade = String(devedorObj.cidade).trim();
          }
          if (devedorObj.email) {
            devedorObj.email = String(devedorObj.email).trim();
          }
          if (devedorObj.celular) {
            let celular = String(devedorObj.celular).replace(/\D/g, "");
            if (celular.length >= 12 && celular.startsWith("55")) celular = celular.slice(2);
            devedorObj.celular = celular;
          }
          if (!devedorObj.celular && Array.isArray(devedorObj.telefones) && devedorObj.telefones.length > 0) {
            let celular = String(devedorObj.telefones[0] ?? "").replace(/\D/g, "");
            if (celular.length >= 12 && celular.startsWith("55")) celular = celular.slice(2);
            devedorObj.celular = celular;
          }

          delete devedorObj.telefones;
          if (!devedorObj.numero && devedorObj.numero !== "") devedorObj.numero = "";
          if (!devedorObj.complemento && devedorObj.complemento !== "") devedorObj.complemento = "";
          cobrancaData.devedor = devedorObj;
          delete cobrancaData.cliente;
        }

        const parcelasArr = cobrancaData.parcelas as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(parcelasArr)) {
          for (const p of parcelasArr) {
            if (typeof p.valor === "number") {
              p.valor = Number(p.valor.toFixed(2));
            }
            const numericIdParcela = Number(p.id_parcela);
            if (p.id_parcela !== undefined && Number.isFinite(numericIdParcela)) {
              p.id_parcela = numericIdParcela;
            } else {
              delete p.id_parcela;
            }
          }
        }

        if (!("sandbox" in cobrancaData)) {
          cobrancaData.sandbox = false;
        }

        console.log("[negociarie-proxy] nova-cobranca structured payload:", JSON.stringify(cobrancaData));
        result = await negociarieRequest("POST", "/cobranca/nova", cobrancaData);
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
        if (params.cpf) qs.set("cpf", String(params.cpf));
        if (params.id_geral) qs.set("id_geral", String(params.id_geral));
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
        const cbUrl = (params.data as any)?.url || (params.data as any)?.url_callback || "";
        const callbackPayload = { url_callback: cbUrl };
        console.log("[negociarie-proxy] Registrando callback:", JSON.stringify(callbackPayload));
        result = await negociarieRequest("POST", "/cobranca/atualizar-url-callback", callbackPayload);
        console.log("[negociarie-proxy] Resposta callback:", JSON.stringify(result));
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
        if (params.cpf) qs.set("cpf", String(params.cpf));
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
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[negociarie-proxy] ERROR: ${message}`);
    if (message.includes("401") || message.includes("autenticar")) {
      cachedToken = null;
      tokenExpiry = 0;
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});