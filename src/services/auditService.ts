import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

export const logAction = async (params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
}): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) return;

    await supabase.from("audit_logs").insert({
      tenant_id: profile.tenant_id,
      user_id: user.id,
      user_name: profile.full_name || "Usuário",
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      details: params.details || {},
    } as any);
  } catch (err) {
    console.warn("[AuditService] Failed to log action:", params.action, err);
  }
};

export const fetchAuditLogs = async (filters?: {
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  entity_type?: string;
  user_id?: string;
}): Promise<AuditLog[]> => {
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters?.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
    query = query.lte("created_at", filters.dateTo + "T23:59:59");
  }
  if (filters?.action && filters.action !== "todos") query = query.eq("action", filters.action);
  if (filters?.entity_type && filters.entity_type !== "todos") query = query.eq("entity_type", filters.entity_type);
  if (filters?.user_id && filters.user_id !== "todos") query = query.eq("user_id", filters.user_id);

  const { data, error } = await query;
  if (error) throw error;
  return (data as AuditLog[]) || [];
};
