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

// --- Evolution API proxy functions ---

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

export async function createEvolutionInstance(instanceName: string) {
  return callEvolutionProxy("create", { instanceName });
}

export async function connectEvolutionInstance(instanceName: string) {
  return callEvolutionProxy("connect", { instanceName });
}

export async function getEvolutionInstanceStatus(instanceName: string) {
  return callEvolutionProxy("status", { instanceName });
}

export async function deleteEvolutionInstance(instanceName: string) {
  return callEvolutionProxy("delete", { instanceName });
}
