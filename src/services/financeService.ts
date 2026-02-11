import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/services/auditService";

export interface Expense {
  id: string;
  tenant_id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  created_by: string;
  created_at: string;
}

export interface ExpenseFormData {
  description: string;
  amount: number;
  category: string;
  expense_date: string;
}

export const fetchExpenses = async (filters?: {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
}): Promise<Expense[]> => {
  let query = supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  if (filters?.dateFrom) query = query.gte("expense_date", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("expense_date", filters.dateTo);
  if (filters?.category && filters.category !== "todos") {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Expense[]) || [];
};

export const createExpense = async (
  data: ExpenseFormData,
  userId: string,
  tenantId: string
): Promise<Expense> => {
  const { data: result, error } = await supabase
    .from("expenses")
    .insert({
      ...data,
      created_by: userId,
      tenant_id: tenantId,
    } as any)
    .select()
    .single();

  if (error) throw error;
  logAction({ action: "create", entity_type: "expense", entity_id: (result as Expense).id, details: { descricao: data.description, valor: data.amount } });
  return result as Expense;
};

export const deleteExpense = async (id: string): Promise<void> => {
  logAction({ action: "delete", entity_type: "expense", entity_id: id });
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
};
