import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendByProvider } from "../_shared/whatsapp-sender.ts";
import { logMessage } from "../_shared/message-logger.ts";

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

  const fallbackEvolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
  const fallbackEvolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
  const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

  // Status tolerados para disparo (prevenção e cobrança)
  const ALLOWED_STATUSES = ["pendente", "em_dia", "EM ABERTO", "INADIMPLENTE"];

  try {
    // 1. Tenants ativos
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, settings")
      .eq("status", "active");
    if (tErr) throw tErr;

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkippedDup = 0;

    for (const tenant of tenants || []) {
      // 2. Regras ativas (com nome do credor para filtrar clientes via coluna textual `credor`)
      const { data: rules, error: rErr } = await supabase
        .from("collection_rules")
        .select("id, name, days_offset, message_template, channel, credor_id, instance_id, tenant_id, credor:credores(razao_social)")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);
      if (rErr) {
        console.error(`[send-notifications] tenant=${tenant.id} rules error:`, rErr);
        continue;
      }

      const settings = (tenant.settings || {}) as Record<string, any>;

      for (const rule of rules || []) {
        // 3. Data alvo
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - rule.days_offset);
        const dateStr = targetDate.toISOString().split("T")[0];

        const eventSource = rule.days_offset < 0 ? "prevention" : "collection";

        // 4. Resolver instância (se a regra define uma)
        let inst: any = null;
        if (rule.instance_id) {
          const { data: instRow, error: instErr } = await supabase
            .from("whatsapp_instances")
            .select("id, instance_url, api_key, instance_name, provider, status")
            .eq("id", rule.instance_id)
            .maybeSingle();
          if (instErr || !instRow) {
            console.error(`[send-notifications] rule=${rule.id} instance ${rule.instance_id} not found:`, instErr);
            continue;
          }
          if (instRow.status === "disconnected") {
            console.warn(`[send-notifications] rule=${rule.id} instance ${rule.instance_id} desconectada — pulando regra`);
            continue;
          }
          inst = {
            provider: instRow.provider || "baylers",
            instance_url: instRow.instance_url,
            api_key: instRow.api_key,
            instance_name: instRow.instance_name,
          };
        }

        // 5. Buscar clientes elegíveis (clients.credor é texto = razao_social)
        let clientQ = supabase
          .from("clients")
          .select("id, nome_completo, cpf, valor_parcela, data_vencimento, credor, phone, email")
          .eq("tenant_id", tenant.id)
          .in("status", ALLOWED_STATUSES)
          .eq("data_vencimento", dateStr);

        const credorNome = (rule as any).credor?.razao_social;
        if (credorNome) {
          clientQ = clientQ.eq("credor", credorNome);
        }

        const { data: clients, error: cErr } = await clientQ;
        if (cErr) {
          console.error(`[send-notifications] rule=${rule.id} clients error:`, cErr);
          continue;
        }

        for (const client of clients || []) {
          const message = rule.message_template
            .replace(/\{\{nome\}\}/g, client.nome_completo || "")
            .replace(/\{\{cpf\}\}/g, client.cpf || "")
            .replace(/\{\{valor_parcela\}\}/g,
              new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
                .format(Number(client.valor_parcela) || 0)
            )
            .replace(/\{\{data_vencimento\}\}/g,
              client.data_vencimento
                ? new Date(client.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")
                : ""
            )
            .replace(/\{\{credor\}\}/g, client.credor || "");

          // 6. WhatsApp
          if (rule.channel === "whatsapp" || rule.channel === "both") {
            if (!client.phone) {
              continue;
            }

            // Idempotência: já enviado hoje para este (rule, client)?
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const { data: dupLog } = await supabase
              .from("message_logs")
              .select("id")
              .eq("tenant_id", tenant.id)
              .eq("client_id", client.id)
              .eq("rule_id", rule.id)
              .eq("status", "sent")
              .gte("created_at", todayStart.toISOString())
              .limit(1)
              .maybeSingle();

            if (dupLog) {
              totalSkippedDup++;
              console.log(`[send-notifications] dup-skip rule=${rule.id} client=${client.id}`);
              continue;
            }

            try {
              let sendOk = false;
              let providerName = "gupshup";
              let providerMessageId: string | null = null;
              let rawResult: any = null;

              if (inst) {
                // Envio via instância configurada (Evolution/Baylers/Wuzapi/Gupshup mapeado)
                const r = await sendByProvider(
                  inst,
                  client.phone,
                  message,
                  settings,
                  fallbackEvolutionUrl,
                  fallbackEvolutionKey,
                  wuzapiUrl,
                  wuzapiAdminToken,
                  null,
                );
                sendOk = r.ok;
                providerName = r.provider;
                providerMessageId = r.providerMessageId;
                rawResult = r.result;
              } else if (settings.gupshup_api_key && settings.gupshup_source_number) {
                // Fallback: Gupshup global do tenant
                const phone = client.phone.replace(/\D/g, "");
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
                sendOk = resp.ok;
                providerName = "gupshup";
                providerMessageId = result?.messageId || null;
                rawResult = result;
              } else {
                console.warn(`[send-notifications] rule=${rule.id} sem instância e sem Gupshup global — pulando cliente`);
                continue;
              }

              const status = sendOk ? "sent" : "failed";

              await logMessage(supabase, {
                tenant_id: tenant.id,
                client_id: client.id,
                client_cpf: client.cpf,
                phone: client.phone,
                channel: "whatsapp",
                status,
                message_body: message,
                error_message: sendOk ? null : (typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult)).slice(0, 500),
                sent_at: sendOk ? new Date().toISOString() : null,
                rule_id: rule.id,
                metadata: {
                  source_type: "trigger",
                  rule_id: rule.id,
                  rule_name: rule.name,
                  days_offset: rule.days_offset,
                  event_source: eventSource,
                  provider: providerName,
                  provider_message_id: providerMessageId,
                  instance_id: rule.instance_id || null,
                },
              });

              if (sendOk) {
                totalSent++;

                // Timeline: client_events
                try {
                  await supabase.from("client_events").insert({
                    tenant_id: tenant.id,
                    client_id: client.id,
                    client_cpf: client.cpf,
                    event_type: "message_sent",
                    event_source: eventSource,
                    event_channel: "whatsapp",
                    event_value: message.slice(0, 200),
                    metadata: {
                      rule_id: rule.id,
                      rule_name: rule.name,
                      days_offset: rule.days_offset,
                      provider: providerName,
                      provider_message_id: providerMessageId,
                      instance_id: rule.instance_id || null,
                    },
                  });
                } catch (evtErr: any) {
                  console.error(`[send-notifications] client_events insert failed:`, evtErr?.message || evtErr);
                }
              } else {
                totalFailed++;
              }
            } catch (err: any) {
              await logMessage(supabase, {
                tenant_id: tenant.id,
                client_id: client.id,
                client_cpf: client.cpf,
                phone: client.phone,
                channel: "whatsapp",
                status: "failed",
                message_body: message,
                error_message: (err?.message || "unknown").slice(0, 500),
                rule_id: rule.id,
                metadata: {
                  source_type: "trigger",
                  rule_id: rule.id,
                  rule_name: rule.name,
                  event_source: eventSource,
                  instance_id: rule.instance_id || null,
                },
              });
              totalFailed++;
            }
          }

          // 7. Email (placeholder — sem provider real)
          if (rule.channel === "email" || rule.channel === "both") {
            if (client.email) {
              await logMessage(supabase, {
                tenant_id: tenant.id,
                client_id: client.id,
                client_cpf: client.cpf,
                channel: "email",
                status: "pending",
                message_body: message,
                error_message: "Email provider not yet configured",
                rule_id: rule.id,
                email_to: client.email,
                metadata: {
                  source_type: "trigger",
                  rule_id: rule.id,
                  rule_name: rule.name,
                  event_source: eventSource,
                  email_to: client.email,
                },
              });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed, skipped_duplicates: totalSkippedDup }),
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
