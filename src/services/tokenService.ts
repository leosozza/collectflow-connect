import { supabase } from "@/integrations/supabase/client";
import type {
  TenantTokens,
  TokenPackage,
  TokenTransaction,
  TokenSummary,
  PaymentRecord,
} from "@/types/tokens";

// ============================================
// TENANT TOKENS
// ============================================

export const fetchTenantTokens = async (tenantId: string): Promise<TenantTokens | null> => {
  const { data, error } = await supabase
    .from("tenant_tokens")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data as TenantTokens | null;
};

export const ensureTenantTokens = async (tenantId: string): Promise<TenantTokens> => {
  const existing = await fetchTenantTokens(tenantId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("tenant_tokens")
    .insert({ tenant_id: tenantId })
    .select()
    .single();
  if (error) throw error;
  return data as TenantTokens;
};

// ============================================
// TOKEN PACKAGES
// ============================================

export const fetchTokenPackages = async (): Promise<TokenPackage[]> => {
  const { data, error } = await supabase
    .from("token_packages")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw error;
  return (data || []) as TokenPackage[];
};

export const fetchAllTokenPackages = async (): Promise<TokenPackage[]> => {
  const { data, error } = await supabase
    .from("token_packages")
    .select("*")
    .order("display_order");
  if (error) throw error;
  return (data || []) as TokenPackage[];
};

export const createTokenPackage = async (pkg: Partial<TokenPackage>): Promise<TokenPackage> => {
  const { data, error } = await supabase
    .from("token_packages")
    .insert(pkg as any)
    .select()
    .single();
  if (error) throw error;
  return data as TokenPackage;
};

export const updateTokenPackage = async (id: string, updates: Partial<TokenPackage>): Promise<TokenPackage> => {
  const { data, error } = await supabase
    .from("token_packages")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TokenPackage;
};

// ============================================
// TOKEN TRANSACTIONS
// ============================================

export const fetchTokenTransactions = async (
  tenantId: string,
  options?: {
    type?: string;
    limit?: number;
    offset?: number;
  }
): Promise<TokenTransaction[]> => {
  let query = supabase
    .from("token_transactions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.type) {
    query = query.eq("transaction_type", options.type);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TokenTransaction[];
};

// ============================================
// RPC FUNCTIONS
// ============================================

export const consumeTokens = async (
  tenantId: string,
  amount: number,
  serviceCode: string,
  description: string,
  referenceId?: string,
  referenceType?: string,
  metadata?: Record<string, any>
) => {
  const { data, error } = await supabase.rpc("consume_tokens", {
    p_tenant_id: tenantId,
    p_amount: amount,
    p_service_code: serviceCode,
    p_description: description,
    p_reference_id: referenceId || null,
    p_reference_type: referenceType || null,
    p_metadata: metadata || {},
  });
  if (error) throw error;
  return data?.[0] || data;
};

export const addTokens = async (
  tenantId: string,
  amount: number,
  transactionType: string,
  description: string,
  referenceId?: string,
  metadata?: Record<string, any>
) => {
  const { data, error } = await supabase.rpc("add_tokens", {
    p_tenant_id: tenantId,
    p_amount: amount,
    p_transaction_type: transactionType,
    p_description: description,
    p_reference_id: referenceId || null,
    p_metadata: metadata || {},
  });
  if (error) throw error;
  return data?.[0] || data;
};

export const checkTokenBalance = async (tenantId: string, requiredAmount: number) => {
  const { data, error } = await supabase.rpc("check_token_balance", {
    p_tenant_id: tenantId,
    p_required_amount: requiredAmount,
  });
  if (error) throw error;
  return data?.[0] || data;
};

export const getTokenSummary = async (tenantId: string): Promise<TokenSummary | null> => {
  const { data, error } = await supabase.rpc("get_tenant_token_summary", {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  return (data?.[0] || data) as TokenSummary | null;
};

// ============================================
// PAYMENT RECORDS
// ============================================

export const fetchPaymentRecords = async (tenantId: string): Promise<PaymentRecord[]> => {
  const { data, error } = await supabase
    .from("payment_records")
    .select("*")
    .eq("tenant_id", tenantId)
    .neq("payment_type", "subscription")
    .or("metadata->>platform_billing.is.null,metadata->>platform_billing.neq.true")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as PaymentRecord[];
};

export const createPaymentRecord = async (record: Partial<PaymentRecord>): Promise<PaymentRecord> => {
  const { data, error } = await supabase
    .from("payment_records")
    .insert(record as any)
    .select()
    .single();
  if (error) throw error;
  return data as PaymentRecord;
};
