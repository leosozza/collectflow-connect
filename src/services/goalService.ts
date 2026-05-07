/**
 * ⚠ ARQUIVO CRÍTICO — ler `docs/README.md` antes de editar.
 * Regras: multi-tenant (`tenant_id` obrigatório), `GoalsMode` decide filtro de `credor_id`.
 * `global` → `IS NULL` | `per_credor` → `IS NOT NULL` | `all` → sem filtro (uso interno).
 */
import { supabase } from "@/integrations/supabase/client";

export interface OperatorGoal {
  id: string;
  tenant_id: string;
  operator_id: string;
  year: number;
  month: number;
  target_amount: number;
  credor_id: string | null;
  points_reward: number;
  points_awarded: boolean;
  created_by: string;
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

export type GoalsMode = "global" | "per_credor" | "all";

export const fetchGoals = async (
  year: number,
  month: number,
  credorId?: string | null,
  tenantId?: string,
  mode: GoalsMode = "all",
): Promise<OperatorGoal[]> => {
  const tid = tenantId || await getMyTenantId();
  if (!tid) return [];

  let query = supabase
    .from("operator_goals")
    .select("*")
    .eq("tenant_id", tid)
    .eq("year", year)
    .eq("month", month);

  if (credorId !== undefined) {
    if (credorId === null) {
      query = query.is("credor_id", null);
    } else {
      query = query.eq("credor_id", credorId);
    }
  } else if (mode === "global") {
    query = query.is("credor_id", null);
  } else if (mode === "per_credor") {
    query = query.not("credor_id", "is", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as OperatorGoal[]) || [];
};

export const fetchTenantGoalsMode = async (tenantId: string): Promise<"global" | "per_credor"> => {
  const { data } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();
  const m = (data?.settings as any)?.goals_mode;
  return m === "per_credor" ? "per_credor" : "global";
};

export const setTenantGoalsMode = async (tenantId: string, mode: "global" | "per_credor"): Promise<void> => {
  const { data } = await supabase.from("tenants").select("settings").eq("id", tenantId).maybeSingle();
  const next = { ...((data?.settings as any) || {}), goals_mode: mode };
  const { error } = await supabase.from("tenants").update({ settings: next } as any).eq("id", tenantId);
  if (error) throw error;
};


export const fetchMyGoals = async (year: number, month: number, tenantId?: string, mode: GoalsMode = "all"): Promise<OperatorGoal[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const tid = tenantId || await getMyTenantId();
  if (!tid) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", tid)
    .single();
  if (!profile) return [];

  let query = supabase
    .from("operator_goals")
    .select("*")
    .eq("tenant_id", tid)
    .eq("operator_id", profile.id)
    .eq("year", year)
    .eq("month", month);

  if (mode === "global") query = query.is("credor_id", null);
  else if (mode === "per_credor") query = query.not("credor_id", "is", null);

  const { data, error } = await query;
  if (error) throw error;
  return (data as OperatorGoal[]) || [];
};

export const fetchMyGoal = async (year: number, month: number): Promise<OperatorGoal | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get profile.id (operator_id is profiles.id, not auth.uid)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!profile) return null;

  const { data, error } = await supabase
    .from("operator_goals")
    .select("*")
    .eq("operator_id", profile.id)
    .eq("year", year)
    .eq("month", month)
    .is("credor_id", null)
    .maybeSingle();
  if (error) throw error;
  return data as OperatorGoal | null;
};

export const upsertGoal = async (params: {
  operator_id: string;
  year: number;
  month: number;
  target_amount: number;
  tenant_id: string;
  created_by: string;
  credor_id?: string | null;
  points_reward?: number;
}): Promise<void> => {
  const credorId = params.credor_id || null;

  let query = supabase
    .from("operator_goals")
    .select("id")
    .eq("operator_id", params.operator_id)
    .eq("year", params.year)
    .eq("month", params.month);

  if (credorId) query = query.eq("credor_id", credorId);
  else query = query.is("credor_id", null);

  const { data: existing } = await query.maybeSingle();

  const payload: any = { target_amount: params.target_amount };
  if (params.points_reward !== undefined) payload.points_reward = params.points_reward;

  if (existing) {
    const { error } = await supabase.from("operator_goals").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("operator_goals").insert({
      operator_id: params.operator_id,
      year: params.year,
      month: params.month,
      target_amount: params.target_amount,
      tenant_id: params.tenant_id,
      created_by: params.created_by,
      credor_id: credorId,
      points_reward: params.points_reward ?? 0,
    } as any);
    if (error) throw error;
  }
};

/** Credita pontos no operator_points.bonus_points se a meta foi batida e ainda não premiada. */
export const awardGoalIfReached = async (params: {
  operator_id: string;
  tenant_id: string;
  year: number;
  month: number;
  total_received: number;
}): Promise<boolean> => {
  const { data } = await supabase
    .from("operator_goals")
    .select("id, target_amount, points_reward, points_awarded")
    .eq("tenant_id", params.tenant_id)
    .eq("operator_id", params.operator_id)
    .eq("year", params.year)
    .eq("month", params.month)
    .is("credor_id", null)
    .maybeSingle();

  const g: any = data;
  if (!g) return false;
  if (g.points_awarded) return false;
  if (!g.points_reward || g.points_reward <= 0) return false;
  if (params.total_received < (g.target_amount || 0)) return false;

  await supabase.rpc("add_operator_bonus_points", {
    _tenant_id: params.tenant_id,
    _operator_id: params.operator_id,
    _year: params.year,
    _month: params.month,
    _amount: g.points_reward,
  });

  await supabase.from("operator_goals").update({ points_awarded: true } as any).eq("id", g.id);
  return true;
};

export interface OperatorGoalHistoryEntry {
  year: number;
  month: number;
  target_amount: number;
  total_received: number;
}

/** Histórico de metas globais (credor_id IS NULL) do operador logado nos últimos N meses. */
export const fetchMyGoalHistory = async (months = 6): Promise<OperatorGoalHistoryEntry[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return [];

  const now = new Date();
  const periods: { year: number; month: number }[] = [];
  for (let i = 1; i <= months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  if (periods.length === 0) return [];

  const minYear = Math.min(...periods.map(p => p.year));

  const [{ data: goals }, { data: points }] = await Promise.all([
    supabase
      .from("operator_goals")
      .select("year, month, target_amount")
      .eq("operator_id", profile.id)
      .is("credor_id", null)
      .gte("year", minYear),
    supabase
      .from("operator_points")
      .select("year, month, total_received")
      .eq("operator_id", profile.id)
      .eq("tenant_id", (profile as any).tenant_id)
      .gte("year", minYear),
  ]);

  const goalMap = new Map((goals || []).map((g: any) => [`${g.year}-${g.month}`, Number(g.target_amount || 0)]));
  const pointsMap = new Map((points || []).map((p: any) => [`${p.year}-${p.month}`, Number(p.total_received || 0)]));

  return periods
    .map((p) => ({
      year: p.year,
      month: p.month,
      target_amount: goalMap.get(`${p.year}-${p.month}`) || 0,
      total_received: pointsMap.get(`${p.year}-${p.month}`) || 0,
    }))
    .filter((e) => e.target_amount > 0 || e.total_received > 0);
};
