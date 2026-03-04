import { supabase } from "@/integrations/supabase/client";

export interface RivoCoinWallet {
  id: string;
  tenant_id: string;
  profile_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  updated_at: string;
}

export interface RivoCoinTransaction {
  id: string;
  tenant_id: string;
  profile_id: string;
  amount: number;
  type: string;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export const fetchMyWallet = async (profileId: string): Promise<RivoCoinWallet | null> => {
  const { data, error } = await supabase
    .from("rivocoin_wallets")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data as RivoCoinWallet | null;
};

export const fetchMyTransactions = async (profileId: string): Promise<RivoCoinTransaction[]> => {
  const { data, error } = await supabase
    .from("rivocoin_transactions")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as RivoCoinTransaction[]) || [];
};

export const creditRivoCoins = async (params: {
  tenant_id: string;
  profile_id: string;
  amount: number;
  description: string;
  reference_type: string;
  reference_id?: string;
}): Promise<void> => {
  // Insert transaction
  const { error: txError } = await supabase.from("rivocoin_transactions").insert({
    tenant_id: params.tenant_id,
    profile_id: params.profile_id,
    amount: params.amount,
    type: "earn",
    description: params.description,
    reference_type: params.reference_type,
    reference_id: params.reference_id || null,
  } as any);
  if (txError) throw txError;

  // Upsert wallet
  const wallet = await fetchMyWallet(params.profile_id);
  if (wallet) {
    const { error } = await supabase
      .from("rivocoin_wallets")
      .update({
        balance: wallet.balance + params.amount,
        total_earned: wallet.total_earned + params.amount,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", wallet.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("rivocoin_wallets").insert({
      tenant_id: params.tenant_id,
      profile_id: params.profile_id,
      balance: params.amount,
      total_earned: params.amount,
      total_spent: 0,
    } as any);
    if (error) throw error;
  }
};

export const spendRivoCoins = async (params: {
  tenant_id: string;
  profile_id: string;
  amount: number;
  description: string;
  reference_type: string;
  reference_id?: string;
}): Promise<void> => {
  const wallet = await fetchMyWallet(params.profile_id);
  if (!wallet || wallet.balance < params.amount) {
    throw new Error("Saldo insuficiente de RivoCoins");
  }

  const { error: txError } = await supabase.from("rivocoin_transactions").insert({
    tenant_id: params.tenant_id,
    profile_id: params.profile_id,
    amount: -params.amount,
    type: "spend",
    description: params.description,
    reference_type: params.reference_type,
    reference_id: params.reference_id || null,
  } as any);
  if (txError) throw txError;

  const { error } = await supabase
    .from("rivocoin_wallets")
    .update({
      balance: wallet.balance - params.amount,
      total_spent: wallet.total_spent + params.amount,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", wallet.id);
  if (error) throw error;
};
