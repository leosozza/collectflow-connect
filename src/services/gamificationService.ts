import { supabase } from "@/integrations/supabase/client";

export interface OperatorPoints {
  id: string;
  tenant_id: string;
  operator_id: string;
  year: number;
  month: number;
  points: number;
  payments_count: number;
  breaks_count: number;
  total_received: number;
  updated_at: string;
}

export interface RankingEntry extends OperatorPoints {
  profile?: { full_name: string; avatar_url: string | null };
  position?: number;
}

export const ACHIEVEMENT_DEFINITIONS = [
  { key: "first_payment", title: "Primeiro Recebimento", description: "Registrou o primeiro pagamento", icon: "🎯" },
  { key: "ten_payments", title: "10 Pagamentos", description: "10 pagamentos acumulados no mês", icon: "🔟" },
  { key: "no_breaks", title: "Sem Quebra no Mês", description: "Zero quebras no mês corrente", icon: "🛡️" },
  { key: "goal_reached", title: "Meta Atingida", description: "100% da meta mensal atingida", icon: "🏆" },
  { key: "top_receiver", title: "Top Recebedor", description: "1º no ranking mensal", icon: "👑" },
  { key: "10k_received", title: "R$10k Recebidos", description: "Acumulado de R$10.000 recebidos", icon: "💰" },
  { key: "50k_received", title: "R$50k Recebidos", description: "Acumulado de R$50.000 recebidos", icon: "💎" },
];

export const calculatePoints = (paymentsCount: number, totalReceived: number, breaksCount: number, achievementsCount: number, goalReached: boolean): number => {
  let points = 0;
  points += paymentsCount * 10;
  points += Math.floor(totalReceived / 100) * 5;
  points -= breaksCount * 3;
  points += achievementsCount * 50;
  if (goalReached) points += 100;
  return Math.max(0, points);
};

export const fetchRanking = async (year: number, month: number): Promise<RankingEntry[]> => {
  const { data: points, error } = await supabase
    .from("operator_points")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .order("points", { ascending: false });

  if (error) throw error;
  if (!points || points.length === 0) return [];

  const operatorIds = [...new Set(points.map((p: any) => p.operator_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", operatorIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  return (points as OperatorPoints[]).map((entry, idx) => ({
    ...entry,
    profile: profileMap.get(entry.operator_id) as { full_name: string; avatar_url: string | null } | undefined,
    position: idx + 1,
  }));
};

export const fetchMyPoints = async (operatorId: string, year: number, month: number): Promise<OperatorPoints | null> => {
  const { data, error } = await supabase
    .from("operator_points")
    .select("*")
    .eq("operator_id", operatorId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) throw error;
  return data as OperatorPoints | null;
};

export const fetchMyPointsHistory = async (operatorId: string): Promise<OperatorPoints[]> => {
  const { data, error } = await supabase
    .from("operator_points")
    .select("*")
    .eq("operator_id", operatorId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(12);

  if (error) throw error;
  return (data as OperatorPoints[]) || [];
};

export const upsertOperatorPoints = async (params: {
  tenant_id: string;
  operator_id: string;
  year: number;
  month: number;
  points: number;
  payments_count: number;
  breaks_count: number;
  total_received: number;
}): Promise<void> => {
  const { error } = await supabase
    .from("operator_points")
    .upsert(
      { ...params, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,operator_id,year,month" }
    );
  if (error) throw error;
};

export const fetchMyAchievements = async (profileId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("achievements")
    .select("title")
    .eq("profile_id", profileId);

  if (error) throw error;
  return (data || []).map((a: any) => a.title);
};

export const grantAchievement = async (params: {
  profile_id: string;
  tenant_id: string;
  title: string;
  description: string;
  icon: string;
}): Promise<boolean> => {
  // Idempotent: check if already exists
  const { data: existing } = await supabase
    .from("achievements")
    .select("id")
    .eq("profile_id", params.profile_id)
    .eq("title", params.title)
    .maybeSingle();

  if (existing) return false; // already granted

  const { error } = await supabase.from("achievements").insert({
    profile_id: params.profile_id,
    tenant_id: params.tenant_id,
    title: params.title,
    description: params.description,
    icon: params.icon,
  });

  if (error) throw error;
  return true; // newly granted
};

export const fetchAllAchievements = async (profileId: string) => {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("profile_id", profileId)
    .order("earned_at", { ascending: false });

  if (error) throw error;
  return data || [];
};
