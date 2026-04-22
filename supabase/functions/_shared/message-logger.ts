/**
 * Logger unificado de mensagens WhatsApp — Fase 3
 * Grava em message_logs com metadata padronizada de rastreabilidade.
 * Usado por campanhas, workflow-engine e régua de cobrança.
 */

export interface LogMessageParams {
  tenant_id: string;
  client_id?: string | null;
  client_cpf?: string | null;
  phone?: string | null;
  channel?: string;
  status: string;
  message_body?: string | null;
  error_message?: string | null;
  sent_at?: string | null;
  rule_id?: string | null;
  email_to?: string | null;
  metadata?: {
    source_type: "campaign" | "workflow" | "trigger" | "system" | "legacy";
    campaign_id?: string;
    workflow_id?: string;
    execution_id?: string;
    node_id?: string;
    provider?: string;
    provider_message_id?: string | null;
    instance_id?: string | null;
    instance_name?: string | null;
    [key: string]: any;
  };
}

export async function logMessage(supabase: any, params: LogMessageParams): Promise<void> {
  try {
    const { error } = await supabase.from("message_logs").insert({
      tenant_id: params.tenant_id,
      client_id: params.client_id || null,
      client_cpf: params.client_cpf || null,
      phone: params.phone || null,
      channel: params.channel || "whatsapp",
      status: params.status,
      message_body: params.message_body || null,
      error_message: params.error_message || null,
      sent_at: params.sent_at || null,
      rule_id: params.rule_id || null,
      email_to: params.email_to || null,
      metadata: params.metadata || null,
    });
    if (error) console.error("logMessage insert error:", error);
  } catch (err) {
    console.error("logMessage error:", err);
  }
}
