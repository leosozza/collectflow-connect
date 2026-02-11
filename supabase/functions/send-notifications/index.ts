import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch active tenants
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, settings")
      .eq("status", "active");
    if (tErr) throw tErr;

    let totalSent = 0;
    let totalFailed = 0;

    for (const tenant of tenants || []) {
      // 2. Fetch active rules for this tenant
      const { data: rules, error: rErr } = await supabase
        .from("collection_rules")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);
      if (rErr) {
        console.error(`Error fetching rules for tenant ${tenant.id}:`, rErr);
        continue;
      }

      const settings = (tenant.settings || {}) as Record<string, any>;

      for (const rule of rules || []) {
        // 3. Calculate target date
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - rule.days_offset);
        const dateStr = targetDate.toISOString().split("T")[0];

        // 4. Find matching clients
        const { data: clients, error: cErr } = await supabase
          .from("clients")
          .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor")
          .eq("tenant_id", tenant.id)
          .eq("status", "pendente")
          .eq("data_vencimento", dateStr);
        if (cErr) {
          console.error(`Error fetching clients:`, cErr);
          continue;
        }

        for (const client of clients || []) {
          const message = rule.message_template
            .replace(/\{\{nome\}\}/g, client.nome_completo)
            .replace(/\{\{cpf\}\}/g, client.cpf)
            .replace(/\{\{valor_parcela\}\}/g,
              new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(client.valor_parcela)
            )
            .replace(/\{\{data_vencimento\}\}/g,
              new Date(client.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")
            )
            .replace(/\{\{credor\}\}/g, client.credor);

          // Send WhatsApp via Gupshup
          if ((rule.channel === "whatsapp" || rule.channel === "both") &&
              settings.gupshup_api_key && settings.gupshup_source_number) {
            // We need a phone number - using CPF as placeholder since clients table doesn't have phone
            // In production, add a phone column to clients
            const phone = settings.gupshup_source_number; // placeholder
            try {
              const body = new URLSearchParams({
                channel: "whatsapp",
                source: settings.gupshup_source_number,
                destination: phone,
                "src.name": settings.gupshup_app_name || "",
                message: JSON.stringify({ type: "text", text: message }),
              });

              const resp = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
                method: "POST",
                headers: {
                  apikey: settings.gupshup_api_key,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: body.toString(),
              });

              const result = await resp.json();
              const status = resp.ok ? "sent" : "failed";

              await supabase.from("message_logs").insert({
                tenant_id: tenant.id,
                client_id: client.id,
                rule_id: rule.id,
                channel: "whatsapp",
                status,
                phone,
                message_body: message,
                error_message: status === "failed" ? JSON.stringify(result) : null,
                sent_at: status === "sent" ? new Date().toISOString() : null,
              });

              if (status === "sent") totalSent++;
              else totalFailed++;
            } catch (err: any) {
              await supabase.from("message_logs").insert({
                tenant_id: tenant.id,
                client_id: client.id,
                rule_id: rule.id,
                channel: "whatsapp",
                status: "failed",
                phone,
                message_body: message,
                error_message: err.message,
              });
              totalFailed++;
            }
          }

          // Email placeholder - would need email column on clients
          if (rule.channel === "email" || rule.channel === "both") {
            await supabase.from("message_logs").insert({
              tenant_id: tenant.id,
              client_id: client.id,
              rule_id: rule.id,
              channel: "email",
              status: "pending",
              message_body: message,
              error_message: "Email sending not yet configured",
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-notifications error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
