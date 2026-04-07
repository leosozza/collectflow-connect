import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Fetch with 15s timeout */
async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("API timeout (15s)");
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

// ============ EVOLUTION HANDLERS ============

async function evoConnect(instanceName: string, baseUrl: string, apiKey: string) {
  // Logout first to clear stale session
  try {
    await fetchWithTimeout(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE", headers: { apikey: apiKey },
    });
  } catch { /* ignore */ }
  await new Promise(r => setTimeout(r, 1500));

  const connectResp = await fetchWithTimeout(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
    method: "GET", headers: { apikey: apiKey },
  });

  if (connectResp.status === 404) {
    return { error: "Instância não encontrada na API remota", not_found: true };
  }

  let result = await connectResp.json();
  if (!connectResp.ok) return { error: result?.message || "Erro ao conectar" };

  const getQr = (r: any) => r?.base64 || r?.qrcode?.base64 || r?.code;
  if (!getQr(result)) {
    // Force QR generation
    await fetchWithTimeout(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE", headers: { apikey: apiKey },
    }).catch(() => {});
    await fetchWithTimeout(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: "GET", headers: { apikey: apiKey },
    }).catch(() => {});

    for (let i = 1; i <= 6; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const qrResp = await fetchWithTimeout(`${baseUrl}/instance/qrcode/${encodeURIComponent(instanceName)}`, {
        method: "GET", headers: { apikey: apiKey, "Content-Type": "application/json" },
      });
      if (qrResp.ok) {
        const qrResult = await qrResp.json();
        if (getQr(qrResult)) { result = qrResult; break; }
      }
    }
  }
  return result;
}

async function evoStatus(instanceName: string, baseUrl: string, apiKey: string) {
  const resp = await fetchWithTimeout(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
    method: "GET", headers: { apikey: apiKey },
  });
  if (resp.status === 404) return { instance: { instanceName, state: "close" } };
  const result = await resp.json();
  if (!resp.ok) throw new Error(result?.message || "Erro ao consultar status");
  return result;
}

async function evoRestart(instanceName: string, baseUrl: string, apiKey: string) {
  try {
    await fetchWithTimeout(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE", headers: { apikey: apiKey },
    });
  } catch { /* ignore */ }
  await new Promise(r => setTimeout(r, 1500));
  const resp = await fetchWithTimeout(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
    method: "GET", headers: { apikey: apiKey },
  });
  return await resp.json().catch(() => ({ success: true }));
}

async function evoDisconnect(instanceName: string, baseUrl: string, apiKey: string) {
  try {
    await fetchWithTimeout(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE", headers: { apikey: apiKey },
    });
  } catch { /* ignore */ }
  return { success: true };
}

async function evoDelete(instanceName: string, baseUrl: string, apiKey: string) {
  try {
    await fetchWithTimeout(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE", headers: { apikey: apiKey },
    });
  } catch { /* ignore */ }
  const resp = await fetchWithTimeout(`${baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
    method: "DELETE", headers: { apikey: apiKey, "Content-Type": "application/json" },
  });
  if (resp.status === 404) return { success: true, message: "Já deletada" };
  const result = await resp.json().catch(() => ({ success: true }));
  if (!resp.ok) throw new Error(result?.message || "Erro ao deletar");
  return result;
}

async function evoSetWebhook(instanceName: string, baseUrl: string, apiKey: string, webhookUrl: string) {
  const resp = await fetchWithTimeout(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      webhook: {
        url: webhookUrl,
        enabled: true,
        webhook_by_events: false,
        webhook_base64: false,
        events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
      },
    }),
  });
  return await resp.json().catch(() => ({ success: true }));
}

// ============ WUZAPI HANDLERS ============

async function wuzConnect(instanceUrl: string, token: string) {
  const resp = await fetchWithTimeout(`${instanceUrl}/session/connect`, {
    method: "POST",
    headers: { Token: token, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const result = await resp.json().catch(() => ({}));
  if (!resp.ok && resp.status !== 409) throw new Error(result?.message || "Erro ao conectar WuzAPI");
  return result;
}

async function wuzQrCode(instanceUrl: string, token: string) {
  const resp = await fetchWithTimeout(`${instanceUrl}/session/qr`, {
    method: "GET", headers: { Token: token },
  });
  return await resp.json().catch(() => ({}));
}

async function wuzStatus(instanceUrl: string, token: string) {
  const resp = await fetchWithTimeout(`${instanceUrl}/session/status`, {
    method: "GET", headers: { Token: token },
  });
  if (resp.status === 404) return { state: "disconnected" };
  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(result?.message || "Erro ao consultar status");
  return result;
}

async function wuzDisconnect(instanceUrl: string, token: string) {
  const resp = await fetchWithTimeout(`${instanceUrl}/session/disconnect`, {
    method: "POST",
    headers: { Token: token, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return await resp.json().catch(() => ({ success: true }));
}

async function wuzSetWebhook(instanceUrl: string, token: string, webhookUrl: string) {
  const resp = await fetchWithTimeout(`${instanceUrl}/webhook`, {
    method: "POST",
    headers: { Token: token, "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  return await resp.json().catch(() => ({ success: true }));
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  const userId = claimsData.claims.sub as string;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = await req.json().catch(() => ({}));
    const { instanceId } = body;

    if (!instanceId) {
      return jsonResp({ error: "instanceId é obrigatório" }, 400);
    }

    // Resolve tenant
    const { data: tenantRow } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!tenantRow) return jsonResp({ error: "Tenant não encontrado" }, 403);

    // Fetch instance with tenant isolation
    const { data: inst, error: instErr } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, instance_url, api_key, provider, tenant_id")
      .eq("id", instanceId)
      .eq("tenant_id", tenantRow.tenant_id)
      .single();

    if (instErr || !inst) {
      return jsonResp({ error: "Instância não encontrada" }, 404);
    }

    const provider = (inst.provider || "evolution").toLowerCase();
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

    // Evolution: resolve URL/key
    const evoUrl = (inst.instance_url || Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/+$/, "");
    const evoKey = inst.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";

    // WuzAPI: resolve URL/token
    const wuzUrl = (inst.instance_url || Deno.env.get("WUZAPI_API_URL") || "").replace(/\/+$/, "");
    const wuzToken = inst.api_key || Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

    let result: any;

    switch (action) {
      case "connect": {
        if (provider === "wuzapi") {
          result = await wuzConnect(wuzUrl, wuzToken);
        } else {
          result = await evoConnect(inst.instance_name, evoUrl, evoKey);
        }
        break;
      }

      case "qrcode": {
        if (provider === "wuzapi") {
          result = await wuzQrCode(wuzUrl, wuzToken);
        } else {
          // Evolution: connect already returns QR, but try dedicated endpoint
          const resp = await fetchWithTimeout(`${evoUrl}/instance/qrcode/${encodeURIComponent(inst.instance_name)}`, {
            method: "GET", headers: { apikey: evoKey, "Content-Type": "application/json" },
          });
          result = await resp.json().catch(() => ({}));
        }
        break;
      }

      case "status": {
        if (provider === "wuzapi") {
          const wuzResult = await wuzStatus(wuzUrl, wuzToken);
          // Normalize to common format
          result = {
            instance: {
              instanceName: inst.instance_name,
              state: wuzResult?.Connected ? "open" : "disconnected",
            },
            raw: wuzResult,
          };
        } else {
          result = await evoStatus(inst.instance_name, evoUrl, evoKey);
        }
        break;
      }

      case "restart": {
        if (provider === "wuzapi") {
          await wuzDisconnect(wuzUrl, wuzToken).catch(() => {});
          await new Promise(r => setTimeout(r, 1000));
          result = await wuzConnect(wuzUrl, wuzToken);
        } else {
          result = await evoRestart(inst.instance_name, evoUrl, evoKey);
        }
        break;
      }

      case "disconnect": {
        if (provider === "wuzapi") {
          result = await wuzDisconnect(wuzUrl, wuzToken);
        } else {
          result = await evoDisconnect(inst.instance_name, evoUrl, evoKey);
        }
        break;
      }

      case "delete": {
        if (provider === "wuzapi") {
          await wuzDisconnect(wuzUrl, wuzToken).catch(() => {});
        } else {
          await evoDelete(inst.instance_name, evoUrl, evoKey).catch(() => {});
        }
        result = { success: true };
        break;
      }

      case "setWebhook": {
        if (provider === "wuzapi") {
          result = await wuzSetWebhook(wuzUrl, wuzToken, webhookUrl);
        } else {
          result = await evoSetWebhook(inst.instance_name, evoUrl, evoKey, webhookUrl);
        }
        break;
      }

      default:
        return jsonResp({ error: "Ação inválida. Use: connect, qrcode, status, restart, disconnect, delete, setWebhook" }, 400);
    }

    return jsonResp(result || { success: true });
  } catch (err: any) {
    console.error("instance-proxy error:", err);
    return jsonResp({ error: err.message || "Erro interno" }, 500);
  }
});
