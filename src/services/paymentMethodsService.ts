import { supabase } from "@/integrations/supabase/client";

export interface PaymentMethod {
  id: string;
  tenant_id: string;
  credor_id: string | null;
  nome: string;
  descricao: string | null;
  created_at?: string;
}

export interface PaymentMapping {
  id: string;
  tenant_id: string;
  credor_id: string;
  external_code: string;
  internal_id: string;
  created_at?: string;
}

// ====== MEIOS DE PAGAMENTO ======
export const fetchPaymentMethods = async (tenantId: string, credorId?: string): Promise<PaymentMethod[]> => {
  let query = supabase
    .from("meios_pagamento" as any)
    .select("*")
    .eq("tenant_id", tenantId);

  if (credorId) {
    // If credorId provided, fetch globals (null) OR specific to this credor
    query = query.or(`credor_id.is.null,credor_id.eq.${credorId}`);
  } else {
    // If no credorId, only globals
    query = query.is("credor_id", null);
  }

  const { data, error } = await query.order("nome");
  if (error) throw error;
  return (data || []) as any as PaymentMethod[];
};

export const upsertPaymentMethod = async (method: Partial<PaymentMethod>) => {
  const { data, error } = await supabase
    .from("meios_pagamento" as any)
    .upsert(method)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePaymentMethod = async (id: string) => {
  const { error } = await supabase
    .from("meios_pagamento" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
};

// ====== MAPEAMENTOS (TRADUTOR) ======
export const fetchPaymentMappings = async (tenantId: string, credorId: string): Promise<PaymentMapping[]> => {
  const { data, error } = await supabase
    .from("meio_pagamento_mappings" as any)
    .select(`
      *,
      internal:meios_pagamento(id, nome)
    `)
    .eq("tenant_id", tenantId)
    .eq("credor_id", credorId);
  
  if (error) throw error;
  return (data || []) as any as PaymentMapping[];
};

export const upsertPaymentMapping = async (mapping: Partial<PaymentMapping>) => {
  const { data, error } = await supabase
    .from("meio_pagamento_mappings" as any)
    .upsert(mapping)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deletePaymentMapping = async (id: string) => {
  const { error } = await supabase
    .from("meio_pagamento_mappings" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
};
