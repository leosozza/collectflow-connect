import { supabase } from "@/integrations/supabase/client";

export interface OperatorGoal {
  id: string;
  tenant_id: string;
  operator_id: string;
  year: number;
  month: number;
  target_amount: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const fetchGoals = async (year: number, month: number): Promise<OperatorGoal[]> => {
  const { data, error } = await supabase
    .from("operator_goals")
    .select("*")
    .eq("year", year)
    .eq("month", month);
  if (error) throw error;
  return (data as OperatorGoal[]) || [];
};

export const fetchMyGoal = async (year: number, month: number): Promise<OperatorGoal | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("operator_goals")
    .select("*")
    .eq("operator_id", user.id)
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
}): Promise<void> => {
  const { error } = await supabase
    .from("operator_goals")
    .upsert({
      operator_id: params.operator_id,
      year: params.year,
      month: params.month,
      target_amount: params.target_amount,
      tenant_id: params.tenant_id,
      created_by: params.created_by,
    } as any, { onConflict: "tenant_id,operator_id,year,month" });
  if (error) throw error;
};
