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

    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada. Configure os secrets EVOLUTION_API_URL e EVOLUTION_API_KEY." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = evolutionUrl.replace(/\/+$/, "");
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = await req.json().catch(() => ({}));

    let result: any;

    switch (action) {
      case "create": {
        const { instanceName } = body;
        if (!instanceName) {
          return new Response(JSON.stringify({ error: "instanceName é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers: {
            apikey: evolutionKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
        });

        result = await resp.json();

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao criar instância na Evolution API", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "connect": {
        const { instanceName } = body;
        if (!instanceName) {
          return new Response(JSON.stringify({ error: "instanceName é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
          method: "GET",
          headers: { apikey: evolutionKey },
        });

        result = await resp.json();

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao conectar instância", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "status": {
        const { instanceName } = body;
        if (!instanceName) {
          return new Response(JSON.stringify({ error: "instanceName é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
          method: "GET",
          headers: { apikey: evolutionKey },
        });

        result = await resp.json();

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao consultar status", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "delete": {
        const { instanceName } = body;
        if (!instanceName) {
          return new Response(JSON.stringify({ error: "instanceName é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
          method: "DELETE",
          headers: { apikey: evolutionKey },
        });

        result = await resp.json().catch(() => ({ success: true }));

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao deletar instância", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "sendMessage": {
        const { instanceName, phone, message, mediaUrl, mediaType } = body;
        if (!instanceName || !phone) {
          return new Response(JSON.stringify({ error: "instanceName e phone são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const payload: any = {
          number: phone.includes("@") ? phone : `${phone}@s.whatsapp.net`,
        };

        let endpoint = "sendText";
        if (mediaUrl && mediaType) {
          endpoint = "sendMedia";
          payload.mediatype = mediaType;
          payload.media = mediaUrl;
          payload.caption = message || "";
        } else {
          payload.text = message || "";
        }

        const resp = await fetch(`${baseUrl}/message/${endpoint}/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: {
            apikey: evolutionKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        result = await resp.json();

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao enviar mensagem", details: result }), {
            status: resp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;
      }

      case "setWebhook": {
        const { instanceName, webhookUrl } = body;
        if (!instanceName || !webhookUrl) {
          return new Response(JSON.stringify({ error: "instanceName e webhookUrl são obrigatórios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const resp = await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: {
            apikey: evolutionKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
          }),
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
        return new Response(JSON.stringify({ error: "Ação inválida. Use: create, connect, status, delete, sendMessage, setWebhook" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("evolution-proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
