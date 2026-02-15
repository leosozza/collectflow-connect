import { supabase } from "@/integrations/supabase/client";

export interface CollectionRule {
  id: string;
  tenant_id: string;
  credor_id: string | null;
  name: string;
  channel: "whatsapp" | "email" | "both";
  days_offset: number;
  message_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageLog {
  id: string;
  tenant_id: string;
  client_id: string | null;
  rule_id: string | null;
  channel: string;
  status: string;
  phone: string | null;
  email_to: string | null;
  message_body: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export const fetchCollectionRules = async (tenantId: string, credorId?: string): Promise<CollectionRule[]> => {
  let query = supabase
    .from("collection_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("days_offset", { ascending: true });
  if (credorId) query = query.eq("credor_id", credorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as CollectionRule[]) || [];
};

export const createCollectionRule = async (
  rule: Omit<CollectionRule, "id" | "created_at" | "updated_at">
): Promise<CollectionRule> => {
  const { data, error } = await supabase
    .from("collection_rules")
    .insert(rule)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CollectionRule;
};

export const updateCollectionRule = async (
  id: string,
  updates: Partial<Omit<CollectionRule, "id" | "tenant_id" | "created_at" | "updated_at">>
): Promise<CollectionRule> => {
  const { data, error } = await supabase
    .from("collection_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CollectionRule;
};

export const deleteCollectionRule = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("collection_rules")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

export const fetchMessageLogs = async (
  tenantId: string,
  filters?: { channel?: string; status?: string; startDate?: string; endDate?: string }
): Promise<(MessageLog & { client_name?: string; rule_name?: string })[]> => {
  let query = supabase
    .from("message_logs")
    .select("*, clients(nome_completo), collection_rules(name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters?.channel) query = query.eq("channel", filters.channel);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.startDate) query = query.gte("created_at", filters.startDate);
  if (filters?.endDate) query = query.lte("created_at", filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((d: any) => ({
    ...d,
    client_name: d.clients?.nome_completo,
    rule_name: d.collection_rules?.name,
  }));
};
