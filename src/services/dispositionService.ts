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

export const DISPOSITION_TYPES: Record<string, string> = {
  voicemail: "Caixa Postal",
  interrupted: "Ligação Interrompida",
  wrong_contact: "Contato Incorreto",
  callback: "Retornar Ligação",
  negotiated: "Negociar",
  no_answer: "Não Atende",
  promise: "Promessa de Pagamento",
};

export type DispositionType = string;

export interface CustomDispositionType {
  key: string;
  label: string;
  color?: string;
  icon?: string;
  group?: string;
}

/**
 * Resolve disposition types from tenant settings or fallback to defaults.
 */
export const getDispositionTypes = (tenantSettings?: Record<string, any>): Record<string, string> => {
  const custom = tenantSettings?.custom_disposition_types as CustomDispositionType[] | undefined;
  if (custom && Array.isArray(custom) && custom.length > 0) {
    const map: Record<string, string> = {};
    for (const c of custom) {
      map[c.key] = c.label;
    }
    return map;
  }
  return DISPOSITION_TYPES;
};

export const getCustomDispositionList = (tenantSettings?: Record<string, any>): CustomDispositionType[] => {
  const custom = tenantSettings?.custom_disposition_types as CustomDispositionType[] | undefined;
  if (custom && Array.isArray(custom) && custom.length > 0) return custom;
  return Object.entries(DISPOSITION_TYPES).map(([key, label]) => ({ key, label }));
};

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

/**
 * Auto-qualify the active call on 3CPlus after a Rivo disposition.
 * Best-effort: errors are logged but never block the main flow.
 */
export const qualifyOn3CPlus = async (params: {
  dispositionType: string;
  tenantSettings: Record<string, any>;
  agentId: number;
  callId?: string | number;
}): Promise<void> => {
  try {
    const map = params.tenantSettings.threecplus_disposition_map as Record<string, number> | undefined;
    if (!map) return;
    const qualificationId = map[params.dispositionType];
    if (!qualificationId) return;

    const domain = params.tenantSettings.threecplus_domain;
    const apiToken = params.tenantSettings.threecplus_api_token;
    if (!domain || !apiToken) return;

    const callId = params.callId || "current";

    await supabase.functions.invoke("threecplus-proxy", {
      body: {
        action: "qualify_call",
        domain,
        api_token: apiToken,
        agent_id: params.agentId,
        call_id: callId,
        qualification_id: qualificationId,
      },
    });
  } catch (err) {
    console.error("qualifyOn3CPlus error (non-blocking):", err);
  }
};
