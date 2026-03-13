import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/services/auditService";
import { logger } from "@/lib/logger";
import { handleServiceError } from "@/lib/errorHandler";

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

const MODULE = "financeService";

export const fetchExpenses = async (filters?: {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
}): Promise<Expense[]> => {
  try {
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
    logger.info(MODULE, "fetch", { count: data?.length ?? 0 });
    return (data as Expense[]) || [];
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const createExpense = async (
  data: ExpenseFormData,
  userId: string,
  tenantId: string
): Promise<Expense> => {
  try {
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
    logger.info(MODULE, "create", { description: data.description, amount: data.amount });
    logAction({ action: "create", entity_type: "expense", entity_id: (result as Expense).id, details: { descricao: data.description, valor: data.amount } });
    return result as Expense;
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const deleteExpense = async (id: string): Promise<void> => {
  try {
    logAction({ action: "delete", entity_type: "expense", entity_id: id });
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    logger.info(MODULE, "delete", { id });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};
