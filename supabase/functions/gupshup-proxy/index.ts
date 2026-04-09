import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function writeLog(tenantId: string | null, eventType: string, message: string, payload?: any, statusCode?: number) {
  try {
    await supabaseAdmin.from("webhook_logs").insert({
      tenant_id: tenantId,
      function_name: "gupshup-proxy",
      event_type: eventType,
      message,
      payload: payload ? JSON.stringify(payload) : null,
      status_code: statusCode,
    });
  } catch (e) {
    console.error("Failed to write log:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, appName, tenantId } = await req.json();

    if (!apiKey || !appName) {
      throw new Error("apiKey and appName are required");
    }

    // Validate API key by sending a minimal request to the messaging endpoint
    // A 400 (missing params) proves the key is valid; only 401/403 means invalid key
    const requestBody = `channel=whatsapp&source=validation&src.name=${encodeURIComponent(appName)}&destination=0&message={}`;
    const response = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
      method: "POST",
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    const text = await response.text();
    console.log("Gupshup proxy raw response:", text.substring(0, 500));

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      await writeLog(tenantId || null, "error", `Gupshup retornou resposta inválida (status ${response.status})`, { request: { url: "https://api.gupshup.io/wa/api/v1/msg", body: requestBody }, response: { status: response.status, raw: text.substring(0, 500) } }, response.status);
      return new Response(JSON.stringify({
        success: false,
        error: `Gupshup retornou resposta inválida (status ${response.status}): ${text.substring(0, 200)}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For the validation approach: 401/403 = invalid key, anything else = key is valid
    if (response.status === 401 || response.status === 403) {
      await writeLog(tenantId || null, "error", `API Key inválida: Gupshup respondeu ${response.status}`, { request: { url: "https://api.gupshup.io/wa/api/v1/msg", body: requestBody }, response: { status: response.status, body: data } }, response.status);
      return new Response(JSON.stringify({ 
        success: false, 
        error: data.message || "API Key inválida — autenticação falhou",
        status: response.status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Detect "Invalid App Details" — API Key is valid but doesn't match the appName
    if (data?.status === "error" && /invalid app/i.test(data?.message || "")) {
      await writeLog(tenantId || null, "error", `App Name "${appName}" não corresponde à API Key fornecida`, { request: { url: "https://api.gupshup.io/wa/api/v1/msg", body: requestBody }, response: { status: response.status, body: data } }, response.status);
      return new Response(JSON.stringify({
        success: false,
        error: `API Key válida, mas não corresponde ao App Name "${appName}". Verifique se a API Key pertence a este app.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Any other response (200, 400, 412, etc.) means the key IS valid
    await writeLog(tenantId || null, "success", `Conexão testada com sucesso (API Key válida, appName: ${appName})`, { request: { url: "https://api.gupshup.io/wa/api/v1/msg", body: requestBody }, response: { status: response.status, body: data } }, response.status);

    return new Response(JSON.stringify({ 
      success: true, 
      data: { message: "API Key válida", appName, gupshupStatus: response.status }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("gupshup-proxy error:", err);
    await writeLog(null, "error", `Erro interno: ${err.message}`, null, 500);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
