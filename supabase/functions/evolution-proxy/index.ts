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
          const rawMsg = result?.response?.message ?? result?.message;
          const rawMsgStr = Array.isArray(rawMsg)
            ? rawMsg.map((m: any) => (typeof m === "string" ? m : JSON.stringify(m))).join("; ")
            : String(rawMsg || "");

          // Auto-recover: if the name is already in use, delete the orphaned remote instance and retry
          if (resp.status === 403 && rawMsgStr.toLowerCase().includes("already in use")) {
            // Graceful logout first
            try {
              await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
                method: "DELETE",
                headers: { apikey: evolutionKey },
              });
            } catch { /* ignore */ }

            // Delete the orphaned instance
            const delResp = await fetch(`${baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
              method: "DELETE",
              headers: { apikey: evolutionKey, "Content-Type": "application/json" },
            });
            await delResp.json().catch(() => null);

            // Retry creation
            const retryResp = await fetch(`${baseUrl}/instance/create`, {
              method: "POST",
              headers: { apikey: evolutionKey, "Content-Type": "application/json" },
              body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
            });
            result = await retryResp.json();

            if (!retryResp.ok) {
              const retryMsg = result?.response?.message ?? result?.message;
              const retryErrMsg = Array.isArray(retryMsg)
                ? retryMsg.map((m: any) => (typeof m === "string" ? m : JSON.stringify(m))).join("; ")
                : retryMsg || "Erro ao criar instância na Evolution API";
              return new Response(JSON.stringify({ error: retryErrMsg, details: result }), {
                status: retryResp.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            break;
          }

          return new Response(JSON.stringify({ error: rawMsgStr || "Erro ao criar instância na Evolution API", details: result }), {
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

        const connectResp = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
          method: "GET",
          headers: { apikey: evolutionKey },
        });

        // Handle 404: instance deleted remotely
        if (connectResp.status === 404) {
          return new Response(JSON.stringify({
            error: "Instância não encontrada na API remota. Remova e recrie esta instância.",
            not_found: true,
          }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        result = await connectResp.json();

        if (!connectResp.ok) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao conectar instância", details: result }), {
            status: connectResp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // If response has no QR code (e.g. {"count":0}), force logout to clear session → wait → reconnect
        const hasQr = result?.base64 || result?.qrcode?.base64 || result?.code;
        if (!hasQr) {
          // Logout to clear the stale session — this is required to generate a new QR
          try {
            await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
              method: "DELETE",
              headers: { apikey: evolutionKey },
            });
          } catch { /* ignore logout errors */ }

          // Wait 1.5 seconds for the session to be cleared
          await new Promise((resolve) => setTimeout(resolve, 1500));

          // Retry connect — should now return a fresh QR code
          const retryResp = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
            method: "GET",
            headers: { apikey: evolutionKey },
          });
          result = await retryResp.json();

          if (!retryResp.ok) {
            return new Response(JSON.stringify({ error: result?.message || "Erro ao gerar QR Code após logout", details: result }), {
              status: retryResp.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        break;
      }

      case "restart": {
        const { instanceName } = body;
        if (!instanceName) {
          return new Response(JSON.stringify({ error: "instanceName é obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // PUT /instance/restart is not supported on this Evolution API version.
        // Use logout + connect as the effective restart mechanism.
        try {
          await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
            method: "DELETE",
            headers: { apikey: evolutionKey },
          });
        } catch { /* ignore logout errors */ }

        // Wait for session to clear
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const restartConnResp = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
          method: "GET",
          headers: { apikey: evolutionKey },
        });

        result = await restartConnResp.json().catch(() => ({ success: true }));

        if (!restartConnResp.ok && restartConnResp.status !== 404) {
          return new Response(JSON.stringify({ error: result?.message || "Erro ao reiniciar instância", details: result }), {
            status: restartConnResp.status,
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

        // Treat 404 (instance deleted on remote) as disconnected — don't surface as an error
        if (resp.status === 404) {
          result = { instance: { instanceName, state: "close" } };
          break;
        }

        if (!resp.ok) {
          const rawMsg = result?.response?.message ?? result?.message;
          const errMsg = Array.isArray(rawMsg)
            ? rawMsg.map((m: any) => (typeof m === "string" ? m : JSON.stringify(m))).join("; ")
            : rawMsg || "Erro ao consultar status";
          return new Response(JSON.stringify({ error: errMsg, details: result }), {
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

        // Try logout first (graceful disconnect), then delete
        try {
          await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
            method: "DELETE",
            headers: { apikey: evolutionKey },
          });
        } catch {
          // ignore logout errors
        }

        const resp = await fetch(`${baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
          method: "DELETE",
          headers: {
            apikey: evolutionKey,
            "Content-Type": "application/json",
          },
        });

        result = await resp.json().catch(() => ({ success: true }));

        // Treat 404 as success — instance already deleted on remote
        if (resp.status === 404) {
          result = { success: true, message: "Instância não encontrada na API remota (já deletada)." };
          break;
        }

        if (!resp.ok) {
          // Extract readable error message (message may be array of strings or objects)
          const rawMsg = result?.message;
          const errMsg = Array.isArray(rawMsg)
            ? rawMsg.map((m: any) => (typeof m === "string" ? m : JSON.stringify(m))).join("; ")
            : rawMsg || "Erro ao deletar instância";
          return new Response(JSON.stringify({ error: errMsg, details: result }), {
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
            webhook: {
              url: webhookUrl,
              enabled: true,
              webhook_by_events: false,
              webhook_base64: false,
              events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
            },
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
        return new Response(JSON.stringify({ error: "Ação inválida. Use: create, connect, restart, status, delete, sendMessage, setWebhook" }), {
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
