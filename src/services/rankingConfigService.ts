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

export const fetchRankingConfigs = async (): Promise<RankingConfig[]> => {
  const { data, error } = await supabase
    .from("ranking_configs")
    .select("*")
    .order("created_at", { ascending: false });
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
