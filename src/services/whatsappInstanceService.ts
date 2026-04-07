import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppInstance {
  id: string;
  tenant_id: string;
  name: string;
  instance_name: string;
  instance_url: string;
  api_key: string;
  is_default: boolean;
  status: string;
  phone_number: string | null;
  provider: string;
  provider_category: string;
  supports_manual_bulk: boolean;
  supports_campaign_rotation: boolean;
  supports_human_queue: boolean;
  created_at: string;
  updated_at: string;
}

export type WhatsAppInstanceInsert = Omit<WhatsAppInstance, "id" | "created_at" | "updated_at">;

export async function fetchWhatsAppInstances(tenantId: string): Promise<WhatsAppInstance[]> {
  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as WhatsAppInstance[];
}

export async function createWhatsAppInstance(instance: WhatsAppInstanceInsert): Promise<WhatsAppInstance> {
  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .insert(instance as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as WhatsAppInstance;
}

export async function updateWhatsAppInstance(id: string, updates: Partial<WhatsAppInstanceInsert>): Promise<WhatsAppInstance> {
  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as WhatsAppInstance;
}

export async function deleteWhatsAppInstance(id: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_instances" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function setDefaultInstance(id: string, tenantId: string): Promise<void> {
  const { error: resetError } = await supabase
    .from("whatsapp_instances" as any)
    .update({ is_default: false } as any)
    .eq("tenant_id", tenantId);
  if (resetError) throw resetError;

  const { error } = await supabase
    .from("whatsapp_instances" as any)
    .update({ is_default: true } as any)
    .eq("id", id);
  if (error) throw error;
}

// ============ Unified Instance Proxy ============

async function callInstanceProxy(action: string, body: Record<string, any>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/instance-proxy?action=${action}`, {
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

/** Connect instance and get QR code (any provider) */
export async function connectInstance(instanceId: string) {
  return callInstanceProxy("connect", { instanceId });
}

/** Get QR code for instance (any provider) */
export async function getInstanceQrCode(instanceId: string) {
  return callInstanceProxy("qrcode", { instanceId });
}

/** Get connection status (any provider) — returns normalized { instance: { state } } */
export async function getInstanceStatus(instanceId: string) {
  return callInstanceProxy("status", { instanceId });
}

/** Restart instance connection (any provider) */
export async function restartInstance(instanceId: string) {
  return callInstanceProxy("restart", { instanceId });
}

/** Disconnect instance (any provider) */
export async function disconnectInstance(instanceId: string) {
  return callInstanceProxy("disconnect", { instanceId });
}

/** Delete instance from remote provider (any provider) */
export async function deleteInstanceRemote(instanceId: string) {
  return callInstanceProxy("delete", { instanceId });
}

/** Configure webhook for instance (any provider) */
export async function setInstanceWebhook(instanceId: string) {
  return callInstanceProxy("setWebhook", { instanceId });
}

// ============ Legacy Evolution API proxy (only for create) ============

async function callEvolutionProxy(action: string, body: Record<string, any>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/evolution-proxy?action=${action}`, {
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

/** Create Evolution/Baylers instance (provider-specific, needs instanceName) */
export async function createEvolutionInstance(instanceName: string) {
  return callEvolutionProxy("create", { instanceName });
}

// Legacy aliases — redirect to unified proxy
export async function connectEvolutionInstance(instanceName: string) {
  console.warn("[DEPRECATED] connectEvolutionInstance: use connectInstance(instanceId) instead");
  return callEvolutionProxy("connect", { instanceName });
}

export async function getEvolutionInstanceStatus(instanceName: string) {
  console.warn("[DEPRECATED] getEvolutionInstanceStatus: use getInstanceStatus(instanceId) instead");
  return callEvolutionProxy("status", { instanceName });
}

export async function deleteEvolutionInstance(instanceName: string) {
  console.warn("[DEPRECATED] deleteEvolutionInstance: use deleteInstanceRemote(instanceId) instead");
  return callEvolutionProxy("delete", { instanceName });
}

export async function restartEvolutionInstance(instanceName: string) {
  console.warn("[DEPRECATED] restartEvolutionInstance: use restartInstance(instanceId) instead");
  return callEvolutionProxy("restart", { instanceName });
}

export async function setEvolutionWebhook(instanceName: string) {
  console.warn("[DEPRECATED] setEvolutionWebhook: use setInstanceWebhook(instanceId) instead");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  return callEvolutionProxy("setWebhook", { instanceName, webhookUrl });
}
