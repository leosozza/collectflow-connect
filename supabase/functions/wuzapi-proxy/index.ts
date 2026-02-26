import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = await req.json().catch(() => ({}));

    // WuzAPI uses per-instance URL and token stored in whatsapp_instances
    const { instanceId } = body;

    // For actions that need instance data, fetch from DB
    let instanceUrl = "";
    let instanceToken = "";

    if (instanceId) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: inst, error: instErr } = await adminClient
        .from("whatsapp_instances")
        .select("instance_url, api_key")
        .eq("id", instanceId)
        .single();
      if (instErr || !inst) {
        return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      instanceUrl = (inst.instance_url || "").replace(/\/+$/, "");
      instanceToken = inst.api_key || "";
    }

    // For create action, URL and token come from the body
    if (action === "create") {
      instanceUrl = (body.serverUrl || "").replace(/\/+$/, "");
      instanceToken = body.adminToken || "";
    }

    if (!instanceUrl) {
      return new Response(JSON.stringify({ error: "URL do servidor WuzAPI não configurada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "create": {
        // WuzAPI: create user (admin endpoint)
        const { userId, userPassword } = body;
        if (!userId || !userPassword) {
          return new Response(JSON.stringify({ error: "userId e userPassword são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${instanceUrl}/admin/users`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${instanceToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: userId, password: userPassword }),
        });

        result = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao criar usuário WuzAPI", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "connect": {
        // WuzAPI: login to get session + QR code
        const resp = await fetch(`${instanceUrl}/session/connect`, {
          method: "POST",
          headers: {
            Token: instanceToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        result = await resp.json().catch(() => ({}));
        if (!resp.ok && resp.status !== 409) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao conectar WuzAPI", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "qrcode": {
        // WuzAPI: get QR code
        const resp = await fetch(`${instanceUrl}/session/qr`, {
          method: "GET",
          headers: { Token: instanceToken },
        });

        result = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao obter QR Code", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "status": {
        // WuzAPI: check connection status
        const resp = await fetch(`${instanceUrl}/session/status`, {
          method: "GET",
          headers: { Token: instanceToken },
        });

        result = await resp.json().catch(() => ({}));

        if (resp.status === 404) {
          result = { state: "disconnected" };
          break;
        }

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao consultar status", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "disconnect": {
        // WuzAPI: disconnect/logout
        const resp = await fetch(`${instanceUrl}/session/disconnect`, {
          method: "POST",
          headers: {
            Token: instanceToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        result = await resp.json().catch(() => ({ success: true }));
        break;
      }

      case "sendMessage": {
        const { phone, message } = body;
        if (!phone || !message) {
          return new Response(JSON.stringify({ error: "phone e message são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
        const resp = await fetch(`${instanceUrl}/chat/send/text`, {
          method: "POST",
          headers: {
            Token: instanceToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone: jid, body: message }),
        });

        result = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao enviar mensagem", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "setWebhook": {
        const { webhookUrl } = body;
        if (!webhookUrl) {
          return new Response(JSON.stringify({ error: "webhookUrl é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${instanceUrl}/webhook`, {
          method: "POST",
          headers: {
            Token: instanceToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: webhookUrl }),
        });

        result = await resp.json().catch(() => ({ success: true }));
        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao configurar webhook", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida. Use: create, connect, qrcode, status, disconnect, sendMessage, setWebhook" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("wuzapi-proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
