import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NEGOCIARIE_BASE = "https://sistema.negociarie.com.br/api/v2";
const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";

const cachedTokens: Record<string, string> = {};
const tokenExpiries: Record<string, number> = {};

// Cliente service-role dedicado APENAS para ler credenciais (RLS deny-SELECT bloqueia o user JWT)
const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getNegociarieConfig(tenantId: string, creditorId?: string) {
  // 1. Credenciais específicas do CREDOR (cobrança direta)
  if (creditorId) {
    const { data: creditor } = await adminClient
      .from("credores")
      .select("cobrança_direta_ativa")
      .eq("id", creditorId)
      .maybeSingle();

    if (creditor?.cobrança_direta_ativa) {
      const { data: creditorIntegration } = await adminClient
        .from("tenant_integrations")
        .select("config")
        .eq("tenant_id", tenantId)
        .eq("creditor_id", creditorId)
        .eq("provider", "negociarie")
        .eq("is_active", true)
        .maybeSingle();

      if (creditorIntegration?.config?.client_id && creditorIntegration?.config?.client_secret) {
        console.log(`[negociarie-proxy] Usando credenciais diretas do credor ${creditorId}`);
        return {
          clientId: creditorIntegration.config.client_id,
          clientSecret: creditorIntegration.config.client_secret,
        };
      }

      // Cobrança direta ativa porém sem credenciais → bloquear (evita emissão pelo CNPJ errado)
      throw new Error(
        "Cobrança direta ativa para este credor mas credenciais Negociarie não cadastradas. Cadastre em Configurações → Integrações → Negociarie."
      );
    }
  }

  // 2. Credenciais do TENANT
  const { data: tenantIntegration } = await adminClient
    .from("tenant_integrations")
    .select("config")
    .eq("tenant_id", tenantId)
    .is("creditor_id", null)
    .eq("provider", "negociarie")
    .eq("is_active", true)
    .maybeSingle();

  const config = (tenantIntegration?.config as Record<string, any>) || {};
  const useGlobal = config.uses_global_fallback === true;

  // 3. Fallback ENV (Y.BRASIL e tenants marcados com uses_global_fallback)
  const clientId = (!useGlobal && config.client_id) || Deno.env.get("NEGOCIARIE_CLIENT_ID");
  const clientSecret = (!useGlobal && config.client_secret) || Deno.env.get("NEGOCIARIE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Negociarie não configuradas para este tenant/credor");
  }

  return { clientId, clientSecret };
}

async function getToken(supabase: any, tenantId: string, creditorId?: string): Promise<string> {
  // O cache de token agora precisa ser por tenant + credor para evitar colisão
  const cacheKey = `token_${tenantId}_${creditorId || "default"}`;
  if (cachedTokens[cacheKey] && Date.now() < tokenExpiries[cacheKey]) {
    return cachedTokens[cacheKey];
  }

  const { clientId, clientSecret } = await getNegociarieConfig(supabase, tenantId, creditorId);

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
  const token = data.access_token || data.token;
  if (!token) throw new Error("Token não retornado pela API Negociarie");
  
  cachedTokens[cacheKey] = token;
  tokenExpiries[cacheKey] = Date.now() + 50 * 60 * 1000;
  return token;
}

async function negociarieRequest(supabase: any, tenantId: string, method: string, endpoint: string, body?: unknown, creditorId?: string) {
  const token = await getToken(supabase, tenantId, creditorId);
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
    const { action, ...params } = await req.json();
    
    // Buscar o tenant_id do usuário
    const { data: userData, error: userError } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (userError || !userData?.tenant_id) {
      console.error("[negociarie-proxy] Tenant not found for user:", userId);
      return new Response(JSON.stringify({ error: "Usuário não associado a um tenant válido" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = userData.tenant_id;
    console.log(`[negociarie-proxy] action=${action} user=${userId} tenant=${tenantId}`);

    let result;

    switch (action) {
      case "test-connection": {
        await getToken(supabase, tenantId);
        result = { connected: true, status: 200 };
        break;
      }

      case "nova-cobranca": {
        let cobrancaData = (params.data as Record<string, unknown>) || {};
        
        // Support both 'cliente' (correct for boleto) and 'devedor' (legacy fallback)
        let clienteObj =
          (cobrancaData.cliente as Record<string, unknown> | undefined) ??
          (cobrancaData.devedor as Record<string, unknown> | undefined);

        // Fallback: if payload is flat (no cliente/devedor wrapper but has documento/nome at root)
        if (!clienteObj && cobrancaData.documento) {
          console.log("[negociarie-proxy] Detected flat payload, wrapping into cliente structure");
          const { id_geral, parcelas, sandbox, ...clientFields } = cobrancaData as any;
          clienteObj = clientFields;
          cobrancaData = {
            cliente: clienteObj,
            id_geral: id_geral || `RIVO-${Date.now()}`,
            parcelas: parcelas || [],
          };
        }

        if (clienteObj) {
          // Clean documento
          if (clienteObj.documento) {
            clienteObj.documento = String(clienteObj.documento).replace(/\D/g, "");
          }
          // Format CEP
          if (clienteObj.cep) {
            const cepDigits = String(clienteObj.cep).replace(/\D/g, "");
            clienteObj.cep = cepDigits.length === 8
              ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`
              : clienteObj.cep;
          }
          // Normalize UF
          if (clienteObj.uf) {
            clienteObj.uf = String(clienteObj.uf).trim().toUpperCase();
          }
          // Trim string fields
          for (const field of ["nome", "endereco", "cidade", "email", "bairro"]) {
            if (clienteObj[field]) {
              clienteObj[field] = String(clienteObj[field]).trim();
            }
          }
          // Ensure numero defaults to "SN" if empty
          if (!clienteObj.numero) clienteObj.numero = "SN";
          if (!clienteObj.complemento && clienteObj.complemento !== "") clienteObj.complemento = "";
          
          // Ensure razao_social exists
          if (!clienteObj.razao_social && clienteObj.razao_social !== "") {
            clienteObj.razao_social = "";
          }

          // Ensure bairro exists (API accepts it; missing bairro may cause validation failure)
          if (!clienteObj.bairro && clienteObj.bairro !== "") {
            clienteObj.bairro = "";
          }

          // Handle telefones: if celular was sent instead of telefones, convert
          if (!clienteObj.telefones && clienteObj.celular) {
            let celular = String(clienteObj.celular).replace(/\D/g, "");
            if (celular.length >= 12 && celular.startsWith("55")) celular = celular.slice(2);
            clienteObj.telefones = [celular];
          }
          // Remove celular (not part of boleto contract)
          delete clienteObj.celular;
          // Ensure telefones is an array
          if (clienteObj.telefones && !Array.isArray(clienteObj.telefones)) {
            clienteObj.telefones = [String(clienteObj.telefones)];
          }

          // Set as 'cliente' root key (boleto contract)
          cobrancaData.cliente = clienteObj;
          delete cobrancaData.devedor;
        }

        const parcelasArr = cobrancaData.parcelas as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(parcelasArr)) {
          for (const p of parcelasArr) {
            // Ensure valor is a float with 2 decimal places
            if (typeof p.valor === "number") {
              p.valor = parseFloat(p.valor.toFixed(2));
            }
            // id_parcela must be a non-zero string per docs
            if (p.id_parcela !== undefined) {
              const strId = String(p.id_parcela);
              if (strId === "0" || strId === "") {
                p.id_parcela = String(Date.now()).slice(-8);
              } else {
                p.id_parcela = strId;
              }
            } else {
              p.id_parcela = String(Date.now()).slice(-8);
            }
            // Ensure valor_mora_dia and valor_multa default
            if (p.valor_mora_dia === undefined) p.valor_mora_dia = 0.10;
            if (p.valor_multa === undefined) p.valor_multa = 2.00;
            // Preserve mensagem and callback_url (do not strip)
          }
        }

        // Remove sandbox (not part of /cobranca/nova contract)
        delete cobrancaData.sandbox;

        console.log("[negociarie-proxy] nova-cobranca id_geral:", cobrancaData.id_geral);
        console.log("[negociarie-proxy] nova-cobranca final payload:", JSON.stringify(cobrancaData));
        result = await negociarieRequest(supabase, tenantId, "POST", "/cobranca/nova", cobrancaData);
        break;
      }

      case "nova-pix": {
        result = await negociarieRequest(supabase, tenantId, "POST", "/cobranca/nova-pix", params.data);
        break;
      }

      case "nova-cartao": {
        result = await negociarieRequest(supabase, tenantId, "POST", "/cobranca/nova-cartao", params.data);
        break;
      }

      case "consulta-cobrancas": {
        const qs = new URLSearchParams();
        if (params.cpf) qs.set("cpf", String(params.cpf));
        if (params.id_geral) qs.set("id_geral", String(params.id_geral));
        if (params.limit) qs.set("limit", String(params.limit));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        result = await negociarieRequest(supabase, tenantId, "GET", `/cobranca/consulta${query}`);
        break;
      }

      case "baixa-manual": {
        result = await negociarieRequest(supabase, tenantId, "POST", "/cobranca/baixa-manual", params.data);
        break;
      }

      case "parcelas-pagas": {
        const data = params.data || new Date().toISOString().split("T")[0];
        result = await negociarieRequest(supabase, tenantId, "GET", `/cobranca/parcelas-pagas?data=${data}`);
        break;
      }

      case "alteradas-hoje": {
        result = await negociarieRequest(supabase, tenantId, "GET", "/cobranca/alteradas-hoje");
        break;
      }

      case "atualizar-callback": {
        const cbUrl = (params.data as any)?.url || (params.data as any)?.url_callback || "";
        const callbackPayload = { url_callback: cbUrl };
        console.log("[negociarie-proxy] Registrando callback:", JSON.stringify(callbackPayload));
        result = await negociarieRequest(supabase, tenantId, "POST", "/cobranca/atualizar-url-callback", callbackPayload);
        console.log("[negociarie-proxy] Resposta callback:", JSON.stringify(result));
        break;
      }

      case "pagamento-credito": {
        result = await negociarieRequest(supabase, tenantId, "POST", "/cobranca/pagamento-credito", params.data);
        break;
      }

      case "cancelar-pagamento": {
        result = await negociarieRequest(supabase, tenantId, "PATCH", "/cobranca/pagamento-credito/cancelar", params.data);
        break;
      }

      case "cancelar-cobranca": {
        const idParcela = (params as any).id_parcela ?? (params.data as any)?.id_parcela;
        if (!idParcela) {
          return new Response(JSON.stringify({ error: "id_parcela é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const idStr = String(idParcela);
        console.log(`[negociarie-proxy] cancelar-cobranca id_parcela=${idStr}`);
        try {
          result = await negociarieRequest(supabase, tenantId, "DELETE", `/cobranca/${encodeURIComponent(idStr)}`);
        } catch (e) {
          // 404 means already cancelled / not found — treat as success for idempotency
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("404")) {
            result = { cancelled: false, reason: "not_found", id_parcela: idStr };
          } else {
            throw e;
          }
        }
        break;
      }

      case "inadimplencia-nova": {
        result = await negociarieRequest(supabase, tenantId, "POST", "/inadimplencia/nova", params.data);
        break;
      }

      case "inadimplencia-titulos": {
        const qs = new URLSearchParams();
        if (params.cpf) qs.set("cpf", String(params.cpf));
        const query = qs.toString() ? `?${qs.toString()}` : "";
        result = await negociarieRequest(supabase, tenantId, "GET", `/inadimplencia/titulos${query}`);
        break;
      }

      case "inadimplencia-acordos": {
        result = await negociarieRequest(supabase, tenantId, "GET", "/inadimplencia/acordos");
        break;
      }

      case "inadimplencia-baixa-parcela": {
        result = await negociarieRequest(supabase, tenantId, "POST", "/inadimplencia/baixa-parcela", params.data);
        break;
      }

      case "inadimplencia-devolucao": {
        result = await negociarieRequest(supabase, tenantId, "POST", "/inadimplencia/devolucao-titulo", params.data);
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

    // Persistir o erro no audit_logs para auditoria do Super Admin
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Usar service role para garantir o log mesmo em falhas de auth
      );

      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: (userData as any)?.tenant_id || null,
        user_id: userId || null,
        user_name: "Sistema (Edge Function)",
        action: `negociarie_error_${action}`,
        entity_type: "integration_error",
        details: {
          message,
          action,
          params: JSON.stringify(params).substring(0, 500), // Mascarar se necessário, aqui estamos limitando tamanho
          timestamp: new Date().toISOString()
        }
      } as any);
    } catch (logErr) {
      console.error("[negociarie-proxy] Falha ao persistir audit_log:", logErr);
    }

    if (message.includes("401") || message.includes("autenticar")) {
      delete cachedTokens[`token_${tenantId}`];
      delete tokenExpiries[`token_${tenantId}`];
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});