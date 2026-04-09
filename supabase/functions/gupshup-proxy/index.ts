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

    const response = await fetch(`https://api.gupshup.io/wa/api/v1/wallet/balance`, {
      method: "GET",
      headers: {
        "apikey": apiKey,
      },
    });

    const text = await response.text();
    console.log("Gupshup proxy raw response:", text.substring(0, 500));

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      await writeLog(tenantId || null, "error", `Gupshup retornou resposta inválida (status ${response.status})`, { raw: text.substring(0, 500) }, response.status);
      return new Response(JSON.stringify({
        success: false,
        error: `Gupshup retornou resposta inválida (status ${response.status}): ${text.substring(0, 200)}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (response.status !== 200) {
      await writeLog(tenantId || null, "error", `Gupshup respondeu com status ${response.status}: ${data.message || "erro desconhecido"}`, { status: response.status, body: data }, response.status);
      return new Response(JSON.stringify({ 
        success: false, 
        error: data.message || "Failed to connect to Gupshup",
        status: response.status 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    await writeLog(tenantId || null, "success", `Conexão testada com sucesso (balance endpoint)`, { body: data }, 200);

    return new Response(JSON.stringify({ 
      success: true, 
      data 
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
