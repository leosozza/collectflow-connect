import { supabase } from "@/integrations/supabase/client";

export interface AchievementTemplate {
  id: string;
  tenant_id: string;
  credor_id: string | null;
  title: string;
  description: string;
  icon: string;
  criteria_type: string;
  criteria_value: number;
  points_reward: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const CRITERIA_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "payments_count", label: "Qtd. de pagamentos" },
  { value: "total_received", label: "Valor recebido (R$)" },
  { value: "no_breaks", label: "Zero quebras no mês" },
  { value: "goal_reached", label: "Meta atingida" },
];

export const fetchAchievementTemplates = async (tenantId: string): Promise<AchievementTemplate[]> => {
  const { data, error } = await supabase
    .from("achievement_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as AchievementTemplate[]) || [];
};

export const createAchievementTemplate = async (
  template: Omit<AchievementTemplate, "id" | "created_at" | "updated_at">
): Promise<AchievementTemplate> => {
  const { data, error } = await supabase
    .from("achievement_templates")
    .insert(template as any)
    .select()
    .single();
  if (error) throw error;
  return data as AchievementTemplate;
};

export const updateAchievementTemplate = async (
  id: string,
  updates: Partial<AchievementTemplate>
): Promise<void> => {
  const { error } = await supabase
    .from("achievement_templates")
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
};

export const deleteAchievementTemplate = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("achievement_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
};
