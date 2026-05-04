import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendByProvider } from "../_shared/whatsapp-sender.ts";
import { logMessage } from "../_shared/message-logger.ts";
import { resolveTemplate } from "../_shared/template-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_EXECUTION_MS = 380_000;

function nowBRTParts(): { date: string; time: string; minutes: number } {
  // en-CA gives YYYY-MM-DD; we manually compose HH:MM:SS in America/Sao_Paulo
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");
  const time = `${hh}:${mm}:${ss}`;
  const minutes = parseInt(hh) * 60 + parseInt(mm);
  return { date, time, minutes };
}

function timeStrToMinutes(t: string): number {
  // accepts HH:MM or HH:MM:SS
  const [h, m] = t.split(":");
  return parseInt(h) * 60 + parseInt(m);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function messageToHtml(message: string): string {
  return escapeHtml(message)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

async function enqueueCollectionEmail(
  supabase: any,
  params: {
    brtDate: string;
    email: string;
    message: string;
    ruleId: string;
    ruleName: string;
    ruleType: "wallet" | "agreement";
    clientCpf?: string | null;
    clientId?: string | null;
    agreementId?: string | null;
    installmentKey?: string | null;
  },
): Promise<{ queueMessageId: number | null; messageId: string }> {
  const cleanCpf = (params.clientCpf || params.clientId || "unknown").replace(/\D/g, "") || "unknown";
  const messageId = [
    "collection_rule",
    params.ruleId,
    params.ruleType,
    params.agreementId || cleanCpf,
    params.installmentKey || "wallet",
    params.brtDate,
    params.email.toLowerCase(),
  ].join(":");

  const from = Deno.env.get("COLLECTION_EMAIL_FROM")
    || Deno.env.get("EMAIL_FROM")
    || "RIVO CONNECT <noreply@rivo.app>";
  const senderDomain = Deno.env.get("COLLECTION_EMAIL_SENDER_DOMAIN")
    || Deno.env.get("EMAIL_SENDER_DOMAIN")
    || Deno.env.get("LOVABLE_EMAIL_SENDER_DOMAIN")
    || null;

  const payload: Record<string, unknown> = {
    run_id: `collection-rule-${params.ruleId}-${params.brtDate}`,
    to: params.email,
    from,
    subject: params.ruleName ? `RIVO Connect - ${params.ruleName}` : "RIVO Connect - Aviso de cobrança",
    html: `
      <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">
        ${messageToHtml(params.message)}
        <p style="margin-top:24px;color:#6b7280;font-size:12px">
          Esta é uma mensagem automática enviada pela régua de cobrança RIVO Connect.
        </p>
      </div>
    `,
    text: params.message,
    purpose: "transactional",
    label: "collection_rule",
    idempotency_key: messageId,
    message_id: messageId,
    queued_at: new Date().toISOString(),
  };

  if (senderDomain) {
    payload.sender_domain = senderDomain;
  }

  const { data, error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload,
  });

  if (error) throw error;
  return { queueMessageId: typeof data === "number" ? data : null, messageId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const fallbackEvolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
  const fallbackEvolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
  const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
  const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

  try {
    const brt = nowBRTParts();
    console.log(`[send-notifications] tick BRT=${brt.date} ${brt.time}`);

    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, settings")
      .eq("status", "active");
    if (tErr) throw tErr;

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkippedDup = 0;
    let totalSkippedWindow = 0;
    let totalSkippedCap = 0;
    let totalEmailQueued = 0;

    for (const tenant of tenants || []) {
      const { data: rules, error: rErr } = await supabase
        .from("collection_rules")
        .select("id, name, days_offset, message_template, channel, credor_id, instance_id, tenant_id, rule_type, send_time_start, send_time_end, min_delay_seconds, max_delay_seconds, daily_cap")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);
      if (rErr) {
        console.error(`[send-notifications] tenant=${tenant.id} rules error:`, rErr);
        continue;
      }

      const settings = (tenant.settings || {}) as Record<string, any>;

      for (const rule of rules || []) {
        // Janela horária BRT
        const startMin = timeStrToMinutes(rule.send_time_start || "09:00");
        const endMin = timeStrToMinutes(rule.send_time_end || "18:00");
        if (brt.minutes < startMin || brt.minutes >= endMin) {
          totalSkippedWindow++;
          console.log(`[send-notifications] rule=${rule.id} out-of-window (${rule.send_time_start}-${rule.send_time_end}, now=${brt.time})`);
          continue;
        }

        // Daily cap (BRT today)
        let remainingCap = Number.POSITIVE_INFINITY;
        if (rule.daily_cap && rule.daily_cap > 0) {
          const todayBRTStartUTC = new Date(`${brt.date}T00:00:00-03:00`).toISOString();
          const { count: sentToday } = await supabase
            .from("message_logs")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("rule_id", rule.id)
            .in("status", ["sent", "pending"])
            .gte("created_at", todayBRTStartUTC);
          remainingCap = Math.max(0, rule.daily_cap - (sentToday || 0));
          if (remainingCap <= 0) {
            totalSkippedCap++;
            console.log(`[send-notifications] rule=${rule.id} skipped_cap (cap=${rule.daily_cap}, sent=${sentToday})`);
            continue;
          }
        }

        const minDelay = Math.max(3, rule.min_delay_seconds || 8);
        const maxDelay = Math.max(minDelay, rule.max_delay_seconds || 15);

        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - rule.days_offset);
        const dateStr = targetDate.toISOString().split("T")[0];

        const eventSource = rule.days_offset < 0 ? "prevention" : "collection";
        const ruleType: "wallet" | "agreement" = (rule as any).rule_type || "wallet";

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

        const { data: targets, error: cErr } = await supabase.rpc("get_rule_eligible_targets", {
          p_rule_id: rule.id,
          p_target_date: dateStr,
        });
        if (cErr) {
          console.error(`[send-notifications] rule=${rule.id} targets error:`, cErr);
          continue;
        }

        let sentInThisRule = 0;

        for (const client of (targets || []) as any[]) {
          // Tempo limite global
          if (Date.now() - startedAt > MAX_EXECUTION_MS) {
            console.warn(`[send-notifications] near-timeout, stopping. Próximo tick continuará.`);
            break;
          }
          // Janela ainda válida?
          const nowCheck = nowBRTParts();
          if (nowCheck.minutes >= endMin) {
            console.log(`[send-notifications] rule=${rule.id} skipped_after_window mid-loop`);
            break;
          }
          // Cap atingido?
          if (sentInThisRule >= remainingCap) {
            console.log(`[send-notifications] rule=${rule.id} cap atingido durante o loop`);
            break;
          }

          const message = resolveTemplate(rule.message_template, client);
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          if (rule.channel === "whatsapp" || rule.channel === "both") {
            if (!client.phone) {
              if (rule.channel === "whatsapp") continue;
            } else {

            let dupQuery = supabase
              .from("message_logs")
              .select("id")
              .eq("tenant_id", tenant.id)
              .eq("rule_id", rule.id)
              .eq("status", "sent")
              .gte("created_at", todayStart.toISOString());

            if (ruleType === "agreement" && client.agreement_id) {
              dupQuery = dupQuery
                .eq("metadata->>agreement_id", client.agreement_id)
                .eq("metadata->>installment_key", client.installment_key || "");
            } else if (client.client_id) {
              dupQuery = dupQuery.eq("client_id", client.client_id);
            } else {
              dupQuery = dupQuery.eq("client_cpf", client.cpf);
            }

            const { data: dupLog } = await dupQuery.limit(1).maybeSingle();

            if (dupLog) {
              totalSkippedDup++;
              if (rule.channel === "whatsapp") continue;
            } else {
              try {
              let sendOk = false;
              let providerName = "gupshup";
              let providerMessageId: string | null = null;
              let rawResult: any = null;

              if (inst) {
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
                if (rule.channel === "whatsapp") continue;
                rawResult = { error: "Nenhuma instância WhatsApp configurada" };
              }

              const status = sendOk ? "sent" : "failed";

              await logMessage(supabase, {
                tenant_id: tenant.id,
                client_id: client.client_id,
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
                  source: client.source || ruleType,
                  rule_id: rule.id,
                  rule_name: rule.name,
                  rule_type: ruleType,
                  days_offset: rule.days_offset,
                  event_source: eventSource,
                  provider: providerName,
                  provider_message_id: providerMessageId,
                  instance_id: rule.instance_id || null,
                  agreement_id: client.agreement_id || null,
                  installment_key: client.installment_key || null,
                  installment_number: client.installment_number ?? null,
                },
              });

              if (sendOk) {
                totalSent++;
                sentInThisRule++;

                if (client.client_id) {
                  try {
                    await supabase.from("client_events").insert({
                      tenant_id: tenant.id,
                      client_id: client.client_id,
                      client_cpf: client.cpf,
                      event_type: "message_sent",
                      event_source: eventSource,
                      event_channel: "whatsapp",
                      event_value: message.slice(0, 200),
                      metadata: {
                        rule_id: rule.id,
                        rule_name: rule.name,
                        rule_type: ruleType,
                        source: client.source || ruleType,
                        days_offset: rule.days_offset,
                        provider: providerName,
                        provider_message_id: providerMessageId,
                        instance_id: rule.instance_id || null,
                        agreement_id: client.agreement_id || null,
                        installment_key: client.installment_key || null,
                      },
                    });
                  } catch (evtErr: any) {
                    console.error(`[send-notifications] client_events insert failed:`, evtErr?.message || evtErr);
                  }
                }

                // Throttle anti-ban entre envios da mesma regra
                const delayMs = (Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay) * 1000;
                await sleep(delayMs);
              } else {
                totalFailed++;
              }
            } catch (err: any) {
              await logMessage(supabase, {
                tenant_id: tenant.id,
                client_id: client.client_id,
                client_cpf: client.cpf,
                phone: client.phone,
                channel: "whatsapp",
                status: "failed",
                message_body: message,
                error_message: (err?.message || "unknown").slice(0, 500),
                rule_id: rule.id,
                metadata: {
                  source_type: "trigger",
                  source: client.source || ruleType,
                  rule_id: rule.id,
                  rule_name: rule.name,
                  rule_type: ruleType,
                  event_source: eventSource,
                  instance_id: rule.instance_id || null,
                  agreement_id: client.agreement_id || null,
                  installment_key: client.installment_key || null,
                },
              });
              totalFailed++;
            }
            }
            }
          }

          if (rule.channel === "email" || rule.channel === "both") {
            if (sentInThisRule >= remainingCap) {
              console.log(`[send-notifications] rule=${rule.id} cap atingido antes do email`);
              continue;
            }

            if (client.email) {
              let emailDupQuery = supabase
                .from("message_logs")
                .select("id")
                .eq("tenant_id", tenant.id)
                .eq("rule_id", rule.id)
                .eq("channel", "email")
                .in("status", ["pending", "sent"])
                .gte("created_at", todayStart.toISOString());

              if (ruleType === "agreement" && client.agreement_id) {
                emailDupQuery = emailDupQuery
                  .eq("metadata->>agreement_id", client.agreement_id)
                  .eq("metadata->>installment_key", client.installment_key || "");
              } else if (client.client_id) {
                emailDupQuery = emailDupQuery.eq("client_id", client.client_id);
              } else {
                emailDupQuery = emailDupQuery.eq("client_cpf", client.cpf);
              }

              const { data: emailDupLog } = await emailDupQuery.limit(1).maybeSingle();
              if (emailDupLog) {
                totalSkippedDup++;
                continue;
              }

              try {
                const queued = await enqueueCollectionEmail(supabase, {
                  brtDate: brt.date,
                  email: client.email,
                  message,
                  ruleId: rule.id,
                  ruleName: rule.name,
                  ruleType,
                  clientCpf: client.cpf,
                  clientId: client.client_id,
                  agreementId: client.agreement_id || null,
                  installmentKey: client.installment_key || null,
                });

                await logMessage(supabase, {
                  tenant_id: tenant.id,
                  client_id: client.client_id,
                  client_cpf: client.cpf,
                  channel: "email",
                  status: "pending",
                  message_body: message,
                  error_message: null,
                  rule_id: rule.id,
                  email_to: client.email,
                  metadata: {
                    source_type: "trigger",
                    source: client.source || ruleType,
                    rule_id: rule.id,
                    rule_name: rule.name,
                    rule_type: ruleType,
                    event_source: eventSource,
                    email_to: client.email,
                    email_queue: "transactional_emails",
                    email_queue_message_id: queued.queueMessageId,
                    email_message_id: queued.messageId,
                    agreement_id: client.agreement_id || null,
                    installment_key: client.installment_key || null,
                  },
                });

                totalEmailQueued++;
                sentInThisRule++;
              } catch (err: any) {
                await logMessage(supabase, {
                  tenant_id: tenant.id,
                  client_id: client.client_id,
                  client_cpf: client.cpf,
                  channel: "email",
                  status: "failed",
                  message_body: message,
                  error_message: (err?.message || "email queue error").slice(0, 500),
                  rule_id: rule.id,
                  email_to: client.email,
                  metadata: {
                    source_type: "trigger",
                    source: client.source || ruleType,
                    rule_id: rule.id,
                    rule_name: rule.name,
                    rule_type: ruleType,
                    event_source: eventSource,
                    email_to: client.email,
                    agreement_id: client.agreement_id || null,
                    installment_key: client.installment_key || null,
                  },
                });
                totalFailed++;
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        failed: totalFailed,
        skipped_duplicates: totalSkippedDup,
        skipped_out_of_window: totalSkippedWindow,
        skipped_daily_cap: totalSkippedCap,
        emails_queued: totalEmailQueued,
        elapsed_ms: Date.now() - startedAt,
      }),
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
