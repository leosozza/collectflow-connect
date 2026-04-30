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
  agreements_count?: number;
}

export const calculatePoints = (paymentsCount: number, totalReceived: number, breaksCount: number, achievementsCount: number, goalReached: boolean): number => {
  let points = 0;
  points += paymentsCount * 10;
  points += Math.floor(totalReceived / 100) * 5;
  points -= breaksCount * 3;
  points += achievementsCount * 50;
  if (goalReached) points += 100;
  return Math.max(0, points);
};

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

export const fetchRanking = async (year: number, month: number): Promise<RankingEntry[]> => {
  const tenantId = await getMyTenantId();
  if (!tenantId) return [];

  // Run independent queries in parallel.
  const [{ data: participants }, pointsRes] = await Promise.all([
    supabase
      .from("gamification_participants")
      .select("profile_id")
      .eq("tenant_id", tenantId)
      .eq("enabled", true),
    supabase
      .from("operator_points")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("year", year)
      .eq("month", month)
      .order("points", { ascending: false }),
  ]);

  if (pointsRes.error) throw pointsRes.error;
  const points = pointsRes.data;

  const enabledIds = new Set((participants || []).map((p: any) => p.profile_id));

  if (!points || points.length === 0) return [];

  const filteredPoints = enabledIds.size > 0
    ? (points as OperatorPoints[]).filter(p => enabledIds.has(p.operator_id))
    : (points as OperatorPoints[]);

  const operatorIds = [...new Set(filteredPoints.map(p => p.operator_id))];
  if (operatorIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, avatar_url, role")
    .eq("tenant_id", tenantId)
    .in("role", ["operador"] as any)
    .in("id", operatorIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const authUidByProfileId = new Map<string, string>();
  const profileIdByAuthUid = new Map<string, string>();
  (profiles || []).forEach((p: any) => {
    const authUid = p.user_id || p.id;
    authUidByProfileId.set(p.id, authUid);
    profileIdByAuthUid.set(authUid, p.id);
  });
  const operatorAuthUids = operatorIds
    .map((id) => authUidByProfileId.get(id))
    .filter(Boolean) as string[];

  // Fetch agreements created in the period per operator
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 1).toISOString();
  const { data: agreementsData } = operatorAuthUids.length > 0
    ? await supabase
        .from("agreements")
        .select("id, created_by")
        .eq("tenant_id", tenantId)
        .in("created_by", operatorAuthUids)
        .gte("created_at", startDate)
        .lt("created_at", endDate)
    : { data: [] } as any;

  // Identify self-cancelled agreements (operator cancelled their own) via audit_logs
  const agreementIds = (agreementsData || []).map((a: any) => a.id);
  const selfCancelledIds = new Set<string>();
  if (agreementIds.length > 0) {
    const { data: cancelLogs } = await supabase
      .from("audit_logs")
      .select("entity_id, user_id")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "agreement")
      .eq("action", "cancel")
      .in("entity_id", agreementIds);

    const creatorByAgreement = new Map<string, string>();
    (agreementsData || []).forEach((a: any) => creatorByAgreement.set(String(a.id), a.created_by));
    (cancelLogs || []).forEach((log: any) => {
      const agreementId = String(log.entity_id || "");
      if (agreementId && creatorByAgreement.get(agreementId) === log.user_id) {
        selfCancelledIds.add(agreementId);
      }
    });
  }

  const agreementsCountMap = new Map<string, number>();
  (agreementsData || []).forEach((a: any) => {
    if (selfCancelledIds.has(String(a.id))) return;
    const profileId = profileIdByAuthUid.get(a.created_by);
    if (!profileId) return;
    agreementsCountMap.set(profileId, (agreementsCountMap.get(profileId) || 0) + 1);
  });

  return filteredPoints.filter((entry) => profileMap.has(entry.operator_id)).map((entry, idx) => ({
    ...entry,
    profile: profileMap.get(entry.operator_id) as { full_name: string; avatar_url: string | null } | undefined,
    position: idx + 1,
    agreements_count: agreementsCountMap.get(entry.operator_id) || 0,
  }));
};

export const fetchMyPoints = async (operatorId: string, year: number, month: number): Promise<OperatorPoints | null> => {
  const tenantId = await getMyTenantId();
  if (!tenantId) return null;

  const { data, error } = await supabase
    .from("operator_points")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("operator_id", operatorId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) throw error;
  return data as OperatorPoints | null;
};

export const fetchMyPointsHistory = async (operatorId: string): Promise<OperatorPoints[]> => {
  const tenantId = await getMyTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("operator_points")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("operator_id", operatorId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(12);

  if (error) throw error;
  return (data as OperatorPoints[]) || [];
};

/** Recalculates the snapshot for the current authenticated user via SECURITY DEFINER RPC. */
export const recalculateMySnapshot = async (year: number, month: number): Promise<void> => {
  const { error } = await supabase.rpc("recalculate_my_gamification_snapshot", {
    _year: year,
    _month: month,
  });
  if (error) throw error;
};

/** Recalculates the snapshot for the entire tenant (admin only). */
export const recalculateTenantSnapshot = async (year: number, month: number): Promise<void> => {
  const { error } = await supabase.rpc("recalculate_tenant_gamification_snapshot", {
    _year: year,
    _month: month,
  });
  if (error) throw error;
};

export const fetchMyAchievements = async (profileId: string): Promise<string[]> => {
  const tenantId = await getMyTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("achievements")
    .select("title")
    .eq("tenant_id", tenantId)
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
  const { data: existing } = await supabase
    .from("achievements")
    .select("id")
    .eq("tenant_id", params.tenant_id)
    .eq("profile_id", params.profile_id)
    .eq("title", params.title)
    .maybeSingle();

  if (existing) return false;

  const { error } = await supabase.from("achievements").insert({
    profile_id: params.profile_id,
    tenant_id: params.tenant_id,
    title: params.title,
    description: params.description,
    icon: params.icon,
  });

  if (error) throw error;
  return true;
};

export const fetchAllAchievements = async (profileId: string) => {
  const tenantId = await getMyTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId)
    .order("earned_at", { ascending: false });

  if (error) throw error;
  return data || [];
};
