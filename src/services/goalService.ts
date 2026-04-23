import { supabase } from "@/integrations/supabase/client";

export interface OperatorGoal {
  id: string;
  tenant_id: string;
  operator_id: string;
  year: number;
  month: number;
  target_amount: number;
  credor_id: string | null;
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

export const fetchGoals = async (year: number, month: number, credorId?: string | null): Promise<OperatorGoal[]> => {
  const tid = await getMyTenantId();
  let query = supabase
    .from("operator_goals")
    .select("*")
    .eq("year", year)
    .eq("month", month);

  if (tid) query = query.eq("tenant_id", tid);

  if (credorId) {
    query = query.eq("credor_id", credorId);
  } else {
    query = query.is("credor_id", null);
  }

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
}): Promise<void> => {
  const credorId = params.credor_id || null;

  // Find existing goal
  let query = supabase
    .from("operator_goals")
    .select("id")
    .eq("operator_id", params.operator_id)
    .eq("year", params.year)
    .eq("month", params.month);

  if (credorId) {
    query = query.eq("credor_id", credorId);
  } else {
    query = query.is("credor_id", null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("operator_goals")
      .update({ target_amount: params.target_amount } as any)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("operator_goals")
      .insert({
        operator_id: params.operator_id,
        year: params.year,
        month: params.month,
        target_amount: params.target_amount,
        tenant_id: params.tenant_id,
        created_by: params.created_by,
        credor_id: credorId,
      } as any);
    if (error) throw error;
  }
};
