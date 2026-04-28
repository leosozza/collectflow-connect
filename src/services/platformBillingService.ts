import { supabase } from "@/integrations/supabase/client";

export interface PlatformBillingAccount {
  id: string;
  provider: string;
  environment: "sandbox" | "production";
  account_label: string;
  wallet_id: string | null;
  webhook_token: string | null;
  last_test_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PlatformBillingType = "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
export type PlatformBillingCycle =
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "BIMONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "YEARLY";

export interface PlatformBillingCustomer {
  id: string;
  tenant_id: string;
  platform_account_id: string;
  asaas_customer_id: string;
  name: string;
  cpf_cnpj: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformBillingSubscription {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  platform_account_id: string;
  platform_customer_id: string;
  asaas_subscription_id: string;
  billing_type: PlatformBillingType;
  cycle: PlatformBillingCycle;
  value: number;
  next_due_date: string;
  status: string;
  description: string | null;
  external_reference: string | null;
  last_payment_id: string | null;
  last_payment_status: string | null;
  last_payment_due_date: string | null;
  last_payment_at: string | null;
  created_at: string;
  updated_at: string;
  platform_billing_customers?: PlatformBillingCustomer | null;
}

const TABLE = "platform_billing_accounts" as any;
const CUSTOMERS_TABLE = "platform_billing_customers" as any;
const SUBSCRIPTIONS_TABLE = "platform_billing_subscriptions" as any;

async function getFunctionErrorMessage(error: any) {
  const context = error?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      return body?.error || body?.errors?.[0]?.description || error.message;
    } catch {
      return error.message;
    }
  }
  return error?.message || "Erro inesperado na função";
}

export async function listPlatformBillingAccounts(): Promise<PlatformBillingAccount[]> {
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as PlatformBillingAccount[];
}

export async function getActivePlatformAccount(provider = "asaas"): Promise<PlatformBillingAccount | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("provider", provider)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as unknown as PlatformBillingAccount | null;
}

export async function upsertPlatformAccount(
  account: Partial<PlatformBillingAccount> & { provider: string; environment: "sandbox" | "production" }
): Promise<PlatformBillingAccount> {
  if (!account.id) {
    const { data: existing } = await supabase
      .from(TABLE)
      .select("id")
      .eq("provider", account.provider)
      .eq("environment", account.environment)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingId = (existing as any)?.id;
    if (existingId) {
      account.id = existingId as string;
    }
  }

  // Garantir que o proxy tenha uma unica conta ativa por provider.
  if (account.is_active) {
    await supabase
      .from(TABLE)
      .update({ is_active: false } as any)
      .eq("provider", account.provider)
      .neq("id", account.id || "00000000-0000-0000-0000-000000000000");
  }
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(account as any, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PlatformBillingAccount;
}

export async function updatePlatformAccount(
  id: string,
  patch: Partial<PlatformBillingAccount>
): Promise<PlatformBillingAccount> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PlatformBillingAccount;
}

export async function testPlatformConnection(): Promise<{
  ok: boolean;
  environment: string;
  message: string;
}> {
  const { data, error } = await supabase.functions.invoke("asaas-platform-proxy", {
    body: { action: "ping" },
  });
  if (error) {
    return { ok: false, environment: "?", message: error.message };
  }
  return data as any;
}

export async function getLatestTenantPlatformSubscription(
  tenantId: string
): Promise<PlatformBillingSubscription | null> {
  const { data: active, error: activeError } = await supabase
    .from(SUBSCRIPTIONS_TABLE)
    .select("*, platform_billing_customers(*)")
    .eq("tenant_id", tenantId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;
  if (active) return active as unknown as PlatformBillingSubscription;

  const { data, error } = await supabase
    .from(SUBSCRIPTIONS_TABLE)
    .select("*, platform_billing_customers(*)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as unknown as PlatformBillingSubscription | null;
}

export async function getTenantPlatformBillingCustomer(
  tenantId: string
): Promise<PlatformBillingCustomer | null> {
  const { data, error } = await supabase
    .from(CUSTOMERS_TABLE)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as unknown as PlatformBillingCustomer | null;
}

export async function createTenantPlatformSubscription(input: {
  tenantId: string;
  planId?: string | null;
  customerName: string;
  cpfCnpj: string;
  email?: string | null;
  phone?: string | null;
  billingType: PlatformBillingType;
  value: number;
  nextDueDate: string;
  cycle: PlatformBillingCycle;
  description?: string;
}) {
  const { data, error } = await supabase.functions.invoke("asaas-platform-proxy", {
    body: { action: "create_tenant_subscription", ...input },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if ((data as any)?.error) {
    throw new Error((data as any).error);
  }

  return data as {
    environment: "sandbox" | "production";
    customer: PlatformBillingCustomer;
    subscription: PlatformBillingSubscription;
    asaas_subscription: Record<string, any>;
    payments?: Record<string, any> | null;
  };
}
