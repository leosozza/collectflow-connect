import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/services/auditService";

export interface CallDisposition {
  id: string;
  client_id: string;
  tenant_id: string;
  operator_id: string;
  disposition_type: string;
  notes: string | null;
  scheduled_callback: string | null;
  created_at: string;
}

export const DISPOSITION_TYPES = {
  voicemail: "Caixa Postal",
  interrupted: "Ligação Interrompida",
  wrong_contact: "Contato Incorreto",
  callback: "Retornar Ligação",
  negotiated: "Negociar",
  no_answer: "Não Atende",
  promise: "Promessa de Pagamento",
} as const;

export type DispositionType = keyof typeof DISPOSITION_TYPES;

export const fetchDispositions = async (clientId: string): Promise<CallDisposition[]> => {
  const { data, error } = await supabase
    .from("call_dispositions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CallDisposition[];
};

export const createDisposition = async (params: {
  client_id: string;
  tenant_id: string;
  operator_id: string;
  disposition_type: string;
  notes?: string;
  scheduled_callback?: string;
}): Promise<CallDisposition> => {
  const { data, error } = await supabase
    .from("call_dispositions")
    .insert(params as any)
    .select()
    .single();
  if (error) throw error;
  logAction({
    action: "disposition",
    entity_type: "client",
    entity_id: params.client_id,
    details: { type: params.disposition_type, notes: params.notes },
  });
  return data as CallDisposition;
};
