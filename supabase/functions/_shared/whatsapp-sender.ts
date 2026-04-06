/**
 * Motor único de envio WhatsApp — Fase 1
 * Suporta: Evolution/Baylers, Gupshup, WuzAPI
 * Extraído de send-bulk-whatsapp para reutilização em campanhas e workflows.
 */

export interface SendResult {
  ok: boolean;
  result: any;
  providerMessageId: string | null;
  provider: string;
}

export async function sendByProvider(
  inst: { provider?: string; instance_url?: string; api_key?: string; instance_name?: string },
  phone: string,
  message: string,
  tenantSettings: Record<string, any>,
  fallbackEvolutionUrl: string,
  fallbackEvolutionKey: string,
  wuzapiUrl: string,
  wuzapiAdminToken: string
): Promise<SendResult> {
  const provider = (inst.provider || "").toLowerCase();

  if (provider === "wuzapi") {
    const baseUrl = inst.instance_url || wuzapiUrl;
    const token = inst.api_key || wuzapiAdminToken;
    if (!baseUrl || !token) {
      return { ok: false, result: { error: "WuzAPI URL ou token não configurado" }, providerMessageId: null, provider };
    }
    const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/send/text`, {
      method: "POST",
      headers: { "Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: `${phone}@s.whatsapp.net`, body: message }),
    });
    const result = await resp.json();
    return { ok: resp.ok, result, providerMessageId: result?.MessageID || result?.messageId || null, provider };
  }

  if (provider === "gupshup") {
    const apiKey = tenantSettings.gupshup_api_key;
    const sourceNumber = tenantSettings.gupshup_source_number;
    const appName = tenantSettings.gupshup_app_name || "";
    if (!apiKey || !sourceNumber) {
      return { ok: false, result: { error: "Credenciais Gupshup não configuradas no tenant" }, providerMessageId: null, provider };
    }
    const formBody = new URLSearchParams({
      channel: "whatsapp",
      source: sourceNumber,
      destination: phone,
      "src.name": appName,
      message: JSON.stringify({ type: "text", text: message }),
    });
    const resp = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });
    const result = await resp.json();
    return { ok: resp.ok, result, providerMessageId: result?.messageId || null, provider };
  }

  // Default: Evolution / Baylers
  const resolvedProvider = provider || "evolution";
  const instanceUrl = (inst.instance_url || fallbackEvolutionUrl).replace(/\/+$/, "");
  const instanceKey = inst.api_key || fallbackEvolutionKey;
  if (!instanceUrl) {
    return { ok: false, result: { error: "URL da instância Evolution não configurada" }, providerMessageId: null, provider: resolvedProvider };
  }
  const resp = await fetch(`${instanceUrl}/message/sendText/${inst.instance_name}`, {
    method: "POST",
    headers: { apikey: instanceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, text: message }),
  });
  const result = await resp.json();
  return { ok: resp.ok, result, providerMessageId: result?.key?.id || result?.messageId || null, provider: resolvedProvider };
}
