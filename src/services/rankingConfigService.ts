import { supabase } from "@/integrations/supabase/client";

export interface RankingConfig {
  id: string;
  tenant_id: string;
  name: string;
  metric: string;
  period: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const getMyTenantId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.tenant_id as string) || null;
};

export const fetchRankingConfigs = async (): Promise<RankingConfig[]> => {
  const tid = await getMyTenantId();
  let query = supabase
    .from("ranking_configs")
    .select("*")
    .order("created_at", { ascending: false });
  if (tid) query = query.eq("tenant_id", tid);
  const { data, error } = await query;
  if (error) throw error;
  return (data as RankingConfig[]) || [];
};

export const createRankingConfig = async (config: { tenant_id: string; name: string; metric: string; period: string }): Promise<void> => {
  const { error } = await supabase.from("ranking_configs").insert(config as any);
  if (error) throw error;
};

export const updateRankingConfig = async (id: string, updates: Partial<RankingConfig>): Promise<void> => {
  const { error } = await supabase.from("ranking_configs").update({ ...updates, updated_at: new Date().toISOString() } as any).eq("id", id);
  if (error) throw error;
};

export const deleteRankingConfig = async (id: string): Promise<void> => {
  const { error } = await supabase.from("ranking_configs").delete().eq("id", id);
  if (error) throw error;
};
