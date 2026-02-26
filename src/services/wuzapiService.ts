import { supabase } from "@/integrations/supabase/client";

async function callWuzapiProxy(action: string, body: Record<string, any>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/wuzapi-proxy?action=${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await resp.json();
  if (!resp.ok) {
    throw new Error(result?.error || `Erro na ação ${action}`);
  }
  return result;
}

export async function createWuzapiUser(serverUrl: string, adminToken: string, userId: string, userPassword: string) {
  return callWuzapiProxy("create", { serverUrl, adminToken, userId, userPassword });
}

export async function connectWuzapiInstance(instanceId: string) {
  return callWuzapiProxy("connect", { instanceId });
}

export async function getWuzapiQrCode(instanceId: string) {
  return callWuzapiProxy("qrcode", { instanceId });
}

export async function getWuzapiStatus(instanceId: string) {
  return callWuzapiProxy("status", { instanceId });
}

export async function disconnectWuzapiInstance(instanceId: string) {
  return callWuzapiProxy("disconnect", { instanceId });
}

export async function setWuzapiWebhook(instanceId: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  return callWuzapiProxy("setWebhook", { instanceId, webhookUrl });
}
