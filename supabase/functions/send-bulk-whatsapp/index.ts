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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Get user's tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .single();

    if (!tenantUser) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins can send bulk
    if (!["admin", "super_admin"].includes(tenantUser.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_ids, message_template } = await req.json();

    if (!client_ids?.length || !message_template) {
      return new Response(JSON.stringify({ error: "client_ids and message_template required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant settings
    const { data: tenant } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantUser.tenant_id)
      .single();

    const settings = (tenant?.settings || {}) as Record<string, any>;
    const provider = settings.whatsapp_provider || (settings.gupshup_api_key ? "gupshup" : settings.baylers_api_key ? "baylers" : "");

    // For Baylers, try whatsapp_instances table first, then global secrets, then legacy settings
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/+$/, "") || "";
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    let baylersInstance: { instance_url: string; api_key: string; instance_name: string } | null = null;
    if (provider === "baylers") {
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("instance_url, api_key, instance_name")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("is_default", true)
        .eq("status", "active")
        .limit(1)
        .single();

      if (instances) {
        const inst = instances as any;
        // Use global Evolution URL as fallback if instance has no URL
        baylersInstance = {
          instance_url: inst.instance_url || evolutionUrl,
          api_key: inst.api_key || evolutionKey,
          instance_name: inst.instance_name,
        };
      } else if (settings.baylers_api_key && settings.baylers_instance_url) {
        // Fallback to legacy settings
        baylersInstance = {
          instance_url: settings.baylers_instance_url,
          api_key: settings.baylers_api_key,
          instance_name: settings.baylers_instance_name || "default",
        };
      }
    }

    if (provider === "gupshup" && (!settings.gupshup_api_key || !settings.gupshup_source_number)) {
      return new Response(JSON.stringify({ error: "Gupshup credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (provider === "baylers" && !baylersInstance) {
      return new Response(JSON.stringify({ error: "Baylers credentials not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!provider) {
      return new Response(JSON.stringify({ error: "No WhatsApp provider configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch clients
    const { data: clients, error: cErr } = await supabase
      .from("clients")
      .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor, phone")
      .eq("tenant_id", tenantUser.tenant_id)
      .in("id", client_ids);

    if (cErr) throw cErr;

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const client of clients || []) {
      // Replace template variables
      const message = message_template
        .replace(/\{\{nome\}\}/g, client.nome_completo)
        .replace(/\{\{cpf\}\}/g, client.cpf)
        .replace(/\{\{valor_parcela\}\}/g,
          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(client.valor_parcela)
        )
        .replace(/\{\{data_vencimento\}\}/g,
          new Date(client.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")
        )
        .replace(/\{\{credor\}\}/g, client.credor);

      if (!client.phone) {
        await supabase.from("message_logs").insert({
          tenant_id: tenantUser.tenant_id,
          client_id: client.id,
          channel: "whatsapp",
          status: "failed",
          message_body: message,
          error_message: "Cliente sem telefone",
        });
        failed++;
        errors.push(`${client.nome_completo}: sem telefone`);
        continue;
      }

      const phone = client.phone.replace(/\D/g, "");

      try {
        let resp: Response;
        let result: any;

        if (provider === "baylers" && baylersInstance) {
          resp = await fetch(`${baylersInstance.instance_url}/message/sendText/${baylersInstance.instance_name}`, {
            method: "POST",
            headers: {
              apikey: baylersInstance.api_key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ number: phone, text: message }),
          });
          result = await resp.json();
        } else {
          const body = new URLSearchParams({
            channel: "whatsapp",
            source: settings.gupshup_source_number,
            destination: phone,
            "src.name": settings.gupshup_app_name || "",
            message: JSON.stringify({ type: "text", text: message }),
          });

          resp = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
            method: "POST",
            headers: {
              apikey: settings.gupshup_api_key,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          });
          result = await resp.json();
        }
        const status = resp.ok ? "sent" : "failed";

        await supabase.from("message_logs").insert({
          tenant_id: tenantUser.tenant_id,
          client_id: client.id,
          channel: "whatsapp",
          status,
          phone,
          message_body: message,
          error_message: status === "failed" ? JSON.stringify(result) : null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        });

        if (status === "sent") sent++;
        else {
          failed++;
          errors.push(`${client.nome_completo}: envio falhou`);
        }

        // Throttle: 100ms between messages
        await new Promise((r) => setTimeout(r, 100));
      } catch (err: any) {
        await supabase.from("message_logs").insert({
          tenant_id: tenantUser.tenant_id,
          client_id: client.id,
          channel: "whatsapp",
          status: "failed",
          phone,
          message_body: message,
          error_message: err.message,
        });
        failed++;
        errors.push(`${client.nome_completo}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: (clients || []).length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-bulk-whatsapp error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
