/**
 * Motor único de envio WhatsApp — suporta Evolution/Baylers, Gupshup, WuzAPI
 * Separação explícita por provider para texto e mídia.
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

/**
 * WuzAPI media sender — fields are PascalCase.
 * Audio does NOT support Caption in WhatsApp.
 * Mimetype is sent for all types.
 */
async function sendWuzapiMedia(
  inst: any, phone: string, media: MediaPayload,
  wuzapiUrl: string, wuzapiAdminToken: string,
): Promise<SendResult> {
  const baseUrl = inst.instance_url || wuzapiUrl;
  const token = inst.api_key || wuzapiAdminToken;
  if (!baseUrl || !token) {
    return { ok: false, result: { error: "WuzAPI URL ou token não configurado" }, providerMessageId: null, provider: "wuzapi" };
  }

  const endpoint = media.mediaType === "image" ? "image"
    : media.mediaType === "video" ? "video"
      : media.mediaType === "audio" ? "audio"
        : "document";

  const payload: any = {
    phone: `${phone}@s.whatsapp.net`,
  };

  if (endpoint === "image") {
    payload.Image = media.mediaUrl;
    payload.Caption = media.caption || "";
    payload.Mimetype = media.mimeType || "image/jpeg";
  } else if (endpoint === "video") {
    payload.Video = media.mediaUrl;
    payload.Caption = media.caption || "";
    payload.Mimetype = media.mimeType || "video/mp4";
  } else if (endpoint === "audio") {
    // WhatsApp does NOT support caption on audio
    payload.Audio = media.mediaUrl;
    payload.Mimetype = media.mimeType || "audio/ogg";
  } else {
    // document
    payload.Document = media.mediaUrl;
    payload.Caption = media.caption || media.fileName || "";
    payload.FileName = media.fileName || "file";
    payload.Mimetype = media.mimeType || "application/octet-stream";
  }

  console.log(`[wuzapi-sender] Sending ${endpoint}: url=${media.mediaUrl.substring(0, 80)}, mime=${payload.Mimetype}`);

  const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/send/${endpoint}`, {
    method: "POST",
    headers: { "Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await resp.json();
  if (!resp.ok) {
    console.error(`[wuzapi-sender] Error HTTP ${resp.status}:`, JSON.stringify(result).substring(0, 300));
  }
  return { ok: resp.ok, result, providerMessageId: result?.MessageID || result?.messageId || null, provider: "wuzapi" };
}

/**
 * Gupshup media sender — official API.
 * Uses different payload shapes per media type.
 * Audio does NOT support caption. Audio REQUIRES filename.
 * Document REQUIRES filename. Image uses originalUrl + previewUrl.
 */
async function sendGupshupMedia(
  phone: string, media: MediaPayload, tenantSettings: Record<string, any>,
): Promise<SendResult> {

  const typeMap: Record<string, string> = {
    image: "image",
    video: "video",
    audio: "file",      // audio como file — Gupshup aceita qualquer formato via file
    document: "file",
  };
  const gupType = typeMap[media.mediaType] || "file";

  const msgPayload: any = { type: gupType };

  if (gupType === "image") {
    msgPayload.originalUrl = media.mediaUrl;
    msgPayload.previewUrl = media.mediaUrl;
    msgPayload.caption = media.caption || "";
  } else if (gupType === "video") {
    msgPayload.url = media.mediaUrl;
    msgPayload.caption = media.caption || "";
  } else {
    // file/document/audio — requires url + filename
    msgPayload.url = media.mediaUrl;
    msgPayload.filename = media.fileName || (media.mediaType === "audio" ? "audio.ogg" : "documento");
    if (media.caption) {
      msgPayload.caption = media.caption;
    }
  }

  console.log(`[gupshup-sender] Sending ${gupType}: payload=${JSON.stringify(msgPayload).substring(0, 200)}`);

  return sendGupshupMsg(phone, JSON.stringify(msgPayload), tenantSettings);
}

/**
 * Evolution/Baylers media sender — non-official API.
 * Uses sendMedia endpoint with mediatype field.
 * Audio does NOT support caption. Mimetype sent for all types.
 */
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
  };

  // WhatsApp does NOT support caption on audio
  if (media.mediaType !== "audio") {
    payload.caption = media.caption || "";
  }

  if (media.fileName) {
    payload.fileName = media.fileName;
  }

  // Evolution accepts mimetype for all media types
  if (media.mimeType) {
    payload.mimetype = media.mimeType;
  }

  console.log(`[evolution-sender] Sending ${media.mediaType}: url=${media.mediaUrl.substring(0, 80)}, mime=${media.mimeType}`);

  const resp = await fetch(`${instanceUrl}/message/sendMedia/${inst.instance_name}`, {
    method: "POST",
    headers: { apikey: instanceKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await resp.json();
  if (!resp.ok) {
    console.error(`[evolution-sender] Error HTTP ${resp.status}:`, JSON.stringify(result).substring(0, 300));
  }
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

  console.log(`[gupshup-sender] Outbound: to=${phone}, source=${sourceNumber}, app=${appName}, msg=${messageJson.substring(0, 150)}`);

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
      "apikey": apiKey,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formBody.toString(),
  });

  const text = await resp.text();
  let result: any;
  try {
    result = JSON.parse(text);
  } catch {
    console.error("[gupshup-sender] Non-JSON response:", text.substring(0, 300));
    return { ok: false, result: { error: `Resposta inválida da Gupshup: ${text.substring(0, 200)}` }, providerMessageId: null, provider: "gupshup" };
  }

  if (!resp.ok) {
    console.error(`[gupshup-sender] API error HTTP ${resp.status}:`, JSON.stringify(result).substring(0, 300));
  }

  return { ok: resp.ok, result, providerMessageId: result?.messageId || null, provider: "gupshup" };
}
