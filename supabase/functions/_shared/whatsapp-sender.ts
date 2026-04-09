/**
 * Motor único de envio WhatsApp — Fase 1 + Fase 6 (mídia)
 * Suporta: Evolution/Baylers, Gupshup, WuzAPI
 * Extraído de send-bulk-whatsapp para reutilização em campanhas, workflows e chat manual.
 */

function normalizePhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) return digits;
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  if (digits.length === 11) return "55" + digits;
  if (digits.length === 10) {
    return "55" + digits.slice(0, 2) + "9" + digits.slice(2);
  }
  return digits;
}

export interface SendResult {
  ok: boolean;
  result: any;
  providerMessageId: string | null;
  provider: string;
}

export interface MediaPayload {
  mediaUrl: string;
  mediaType: "image" | "video" | "audio" | "document";
  caption?: string;
  fileName?: string;
  mimeType?: string;
}

export async function sendByProvider(
  inst: { provider?: string; instance_url?: string; api_key?: string; instance_name?: string },
  phone: string,
  message: string,
  tenantSettings: Record<string, any>,
  fallbackEvolutionUrl: string,
  fallbackEvolutionKey: string,
  wuzapiUrl: string,
  wuzapiAdminToken: string,
  media?: MediaPayload | null,
): Promise<SendResult> {
  const provider = (inst.provider || "").toLowerCase();
  const normalizedPhone = normalizePhoneBR(phone);

  if (provider === "wuzapi") {
    return media
      ? sendWuzapiMedia(inst, normalizedPhone, media, wuzapiUrl, wuzapiAdminToken)
      : sendWuzapiText(inst, normalizedPhone, message, wuzapiUrl, wuzapiAdminToken);
  }

  if (provider === "gupshup") {
    return media
      ? sendGupshupMedia(normalizedPhone, media, tenantSettings)
      : sendGupshupText(normalizedPhone, message, tenantSettings);
  }

  // Default: Evolution / Baylers
  return media
    ? sendEvolutionMedia(inst, normalizedPhone, media, fallbackEvolutionUrl, fallbackEvolutionKey)
    : sendEvolutionText(inst, normalizedPhone, message, fallbackEvolutionUrl, fallbackEvolutionKey);
}

// ========== TEXT SENDERS ==========

async function sendWuzapiText(
  inst: any, phone: string, message: string,
  wuzapiUrl: string, wuzapiAdminToken: string,
): Promise<SendResult> {
  const baseUrl = inst.instance_url || wuzapiUrl;
  const token = inst.api_key || wuzapiAdminToken;
  if (!baseUrl || !token) {
    return { ok: false, result: { error: "WuzAPI URL ou token não configurado" }, providerMessageId: null, provider: "wuzapi" };
  }
  const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/send/text`, {
    method: "POST",
    headers: { "Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ phone: `${phone}@s.whatsapp.net`, body: message }),
  });
  const result = await resp.json();
  return { ok: resp.ok, result, providerMessageId: result?.MessageID || result?.messageId || null, provider: "wuzapi" };
}

function sendGupshupText(
  phone: string, message: string, tenantSettings: Record<string, any>,
): Promise<SendResult> {
  return sendGupshupMsg(phone, JSON.stringify({ type: "text", text: message }), tenantSettings);
}

async function sendEvolutionText(
  inst: any, phone: string, message: string,
  fallbackUrl: string, fallbackKey: string,
): Promise<SendResult> {
  const provider = inst.provider || "evolution";
  const instanceUrl = (inst.instance_url || fallbackUrl).replace(/\/+$/, "");
  const instanceKey = inst.api_key || fallbackKey;
  if (!instanceUrl) {
    return { ok: false, result: { error: "URL da instância Evolution não configurada" }, providerMessageId: null, provider };
  }
  const resp = await fetch(`${instanceUrl}/message/sendText/${inst.instance_name}`, {
    method: "POST",
    headers: { apikey: instanceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: phone, text: message }),
  });
  const result = await resp.json();
  return { ok: resp.ok, result, providerMessageId: result?.key?.id || result?.messageId || null, provider };
}

// ========== MEDIA SENDERS ==========

async function sendWuzapiMedia(
  inst: any, phone: string, media: MediaPayload,
  wuzapiUrl: string, wuzapiAdminToken: string,
): Promise<SendResult> {
  const baseUrl = inst.instance_url || wuzapiUrl;
  const token = inst.api_key || wuzapiAdminToken;
  if (!baseUrl || !token) {
    return { ok: false, result: { error: "WuzAPI URL ou token não configurado" }, providerMessageId: null, provider: "wuzapi" };
  }

  // WuzAPI uses /chat/send/image, /chat/send/document, /chat/send/audio, /chat/send/video
  // For URL-based media, use the respective endpoints
  const typeMap: Record<string, string> = {
    image: "image",
    video: "video",
    audio: "audio",
    document: "document",
  };
  const endpoint = typeMap[media.mediaType] || "document";
  
  const payload: any = {
    phone: `${phone}@s.whatsapp.net`,
  };

  // WuzAPI expects base64 for image but can also accept URLs via document endpoint
  // For simplicity, we send the URL as a document if it's not image
  if (endpoint === "image") {
    payload.Caption = media.caption || "";
    payload.Image = media.mediaUrl; // WuzAPI also supports URLs
  } else if (endpoint === "document") {
    payload.Caption = media.caption || media.fileName || "";
    payload.Document = media.mediaUrl;
    payload.FileName = media.fileName || "file";
    payload.Mimetype = media.mimeType || "application/octet-stream";
  } else if (endpoint === "audio") {
    payload.Audio = media.mediaUrl;
  } else if (endpoint === "video") {
    payload.Caption = media.caption || "";
    payload.Video = media.mediaUrl;
  }

  const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/send/${endpoint}`, {
    method: "POST",
    headers: { "Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await resp.json();
  return { ok: resp.ok, result, providerMessageId: result?.MessageID || result?.messageId || null, provider: "wuzapi" };
}

async function sendGupshupMedia(
  phone: string, media: MediaPayload, tenantSettings: Record<string, any>,
): Promise<SendResult> {
  const typeMap: Record<string, string> = {
    image: "image",
    video: "video",
    audio: "audio",
    document: "file",
  };
  const gupType = typeMap[media.mediaType] || "file";

  const msgPayload: any = {
    type: gupType,
  };

  if (gupType === "image") {
    msgPayload.originalUrl = media.mediaUrl;
    msgPayload.previewUrl = media.mediaUrl;
    msgPayload.caption = media.caption || "";
  } else if (gupType === "video") {
    msgPayload.url = media.mediaUrl;
    msgPayload.caption = media.caption || "";
  } else if (gupType === "audio") {
    msgPayload.url = media.mediaUrl;
  } else {
    msgPayload.url = media.mediaUrl;
    msgPayload.filename = media.fileName || "file";
  }

  return sendGupshupMsg(phone, JSON.stringify(msgPayload), tenantSettings);
}

async function sendEvolutionMedia(
  inst: any, phone: string, media: MediaPayload,
  fallbackUrl: string, fallbackKey: string,
): Promise<SendResult> {
  const provider = inst.provider || "evolution";
  const instanceUrl = (inst.instance_url || fallbackUrl).replace(/\/+$/, "");
  const instanceKey = inst.api_key || fallbackKey;
  if (!instanceUrl) {
    return { ok: false, result: { error: "URL da instância Evolution não configurada" }, providerMessageId: null, provider };
  }

  const payload: any = {
    number: phone,
    mediatype: media.mediaType,
    media: media.mediaUrl,
    caption: media.caption || "",
  };

  if (media.fileName) {
    payload.fileName = media.fileName;
  }

  const resp = await fetch(`${instanceUrl}/message/sendMedia/${inst.instance_name}`, {
    method: "POST",
    headers: { apikey: instanceKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await resp.json();
  return { ok: resp.ok, result, providerMessageId: result?.key?.id || result?.messageId || null, provider };
}

// ========== GUPSHUP HELPER ==========

async function sendGupshupMsg(
  phone: string, messageJson: string, tenantSettings: Record<string, any>,
): Promise<SendResult> {
  const apiKey = tenantSettings.gupshup_api_key;
  const sourceNumber = tenantSettings.gupshup_source_number;
  const appName = tenantSettings.gupshup_app_id || tenantSettings.gupshup_app_name || "";
  
  if (!apiKey || !sourceNumber) {
    return { ok: false, result: { error: "Credenciais Gupshup não configuradas no tenant" }, providerMessageId: null, provider: "gupshup" };
  }

  console.log(`Gupshup outbound: to=${phone}, source=${sourceNumber}, app=${appName}`);

  const formBody = new URLSearchParams({
    channel: "whatsapp",
    source: sourceNumber,
    destination: phone,
    "src.name": appName,
    message: messageJson,
  });

  const resp = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
    method: "POST",
    headers: { 
      "apiKey": apiKey, 
      "Content-Type": "application/x-www-form-urlencoded" 
    },
    body: formBody.toString(),
  });

  const result = await resp.json();
  
  if (!resp.ok) {
    console.error("Gupshup API error:", JSON.stringify(result));
  }

  return { ok: resp.ok, result, providerMessageId: result?.messageId || null, provider: "gupshup" };
}

