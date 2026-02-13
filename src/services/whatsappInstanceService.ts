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
  // Unset all defaults for tenant
  const { error: resetError } = await supabase
    .from("whatsapp_instances" as any)
    .update({ is_default: false } as any)
    .eq("tenant_id", tenantId);
  if (resetError) throw resetError;

  // Set the chosen one
  const { error } = await supabase
    .from("whatsapp_instances" as any)
    .update({ is_default: true } as any)
    .eq("id", id);
  if (error) throw error;
}
