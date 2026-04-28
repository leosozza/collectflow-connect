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

const TABLE = "platform_billing_accounts" as any;

export async function listPlatformBillingAccounts(): Promise<PlatformBillingAccount[]> {
  const { data, error } = await supabase.from(TABLE).select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as PlatformBillingAccount[];
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
  return (data || null) as PlatformBillingAccount | null;
}

export async function upsertPlatformAccount(
  account: Partial<PlatformBillingAccount> & { provider: string; environment: "sandbox" | "production" }
): Promise<PlatformBillingAccount> {
  // Garantir que apenas uma conta ativa por (provider, environment)
  if (account.is_active) {
    await supabase
      .from(TABLE)
      .update({ is_active: false } as any)
      .eq("provider", account.provider)
      .eq("environment", account.environment)
      .neq("id", account.id || "00000000-0000-0000-0000-000000000000");
  }
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(account as any, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as PlatformBillingAccount;
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
  return data as PlatformBillingAccount;
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
