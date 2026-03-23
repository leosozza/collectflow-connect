import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/services/auditService";
import { logger } from "@/lib/logger";

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
  no_answer: "Não Atende",
  cpc: "CPC (Contato com a Pessoa Certa)",
  wrong_contact: "Contato Pessoa Errada",
};

export interface DbDispositionType {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  group_name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  color: string;
  impact: string;
  behavior: string;
  is_conversion: boolean;
  is_cpc: boolean;
  is_unknown: boolean;
  is_callback: boolean;
  is_schedule: boolean;
  is_blocklist: boolean;
  schedule_allow_other_number: boolean;
  schedule_days_limit: number;
  blocklist_mode: string;
  blocklist_days: number;
}

export const fetchTenantDispositionTypes = async (tenantId: string): Promise<DbDispositionType[]> => {
  const { data, error } = await supabase
    .from("call_disposition_types")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as DbDispositionType[];
};

export const DEFAULT_DISPOSITION_LIST = [
  { key: "voicemail", label: "Caixa Postal", group_name: "resultado", sort_order: 0, color: "#3b82f6", impact: "negativo", behavior: "repetir", is_conversion: false, is_cpc: false, is_unknown: false, is_callback: false, is_schedule: false, is_blocklist: false, schedule_allow_other_number: false, schedule_days_limit: 7, blocklist_mode: "indeterminate", blocklist_days: 0 },
  { key: "interrupted", label: "Ligação Interrompida", group_name: "resultado", sort_order: 1, color: "#eab308", impact: "negativo", behavior: "repetir", is_conversion: false, is_cpc: false, is_unknown: false, is_callback: false, is_schedule: false, is_blocklist: false, schedule_allow_other_number: false, schedule_days_limit: 7, blocklist_mode: "indeterminate", blocklist_days: 0 },
  { key: "no_answer", label: "Não Atende", group_name: "resultado", sort_order: 2, color: "#de2128", impact: "negativo", behavior: "repetir", is_conversion: false, is_cpc: false, is_unknown: false, is_callback: false, is_schedule: false, is_blocklist: false, schedule_allow_other_number: false, schedule_days_limit: 7, blocklist_mode: "indeterminate", blocklist_days: 0 },
  { key: "cpc", label: "CPC (Contato com a Pessoa Certa)", group_name: "resultado", sort_order: 3, color: "#28cc39", impact: "positivo", behavior: "repetir", is_conversion: false, is_cpc: true, is_unknown: false, is_callback: false, is_schedule: false, is_blocklist: false, schedule_allow_other_number: false, schedule_days_limit: 7, blocklist_mode: "indeterminate", blocklist_days: 0 },
  { key: "wrong_contact", label: "Contato Pessoa Errada", group_name: "contato", sort_order: 4, color: "#111111", impact: "negativo", behavior: "nao_discar_cliente", is_conversion: false, is_cpc: false, is_unknown: false, is_callback: false, is_schedule: false, is_blocklist: true, schedule_allow_other_number: false, schedule_days_limit: 7, blocklist_mode: "indeterminate", blocklist_days: 0 },
];

export const seedDefaultDispositionTypes = async (tenantId: string): Promise<DbDispositionType[]> => {
  const rows = DEFAULT_DISPOSITION_LIST.map(d => ({ ...d, tenant_id: tenantId }));
  const { data, error } = await supabase
    .from("call_disposition_types")
    .upsert(rows as any, { onConflict: "tenant_id,key" })
    .select();
  if (error) throw error;
  return (data || []) as DbDispositionType[];
};

export const createDispositionType = async (params: {
  tenant_id: string;
  key: string;
  label: string;
  group_name?: string;
  sort_order?: number;
  color?: string;
  impact?: string;
  behavior?: string;
  is_conversion?: boolean;
  is_cpc?: boolean;
  is_unknown?: boolean;
  is_callback?: boolean;
  is_schedule?: boolean;
  is_blocklist?: boolean;
}): Promise<DbDispositionType> => {
  const { data, error } = await supabase
    .from("call_disposition_types")
    .insert(params as any)
    .select()
    .single();
  if (error) throw error;
  return data as DbDispositionType;
};

export const updateDispositionType = async (id: string, params: Partial<{
  label: string;
  group_name: string;
  sort_order: number;
  active: boolean;
  color: string;
  impact: string;
  behavior: string;
  is_conversion: boolean;
  is_cpc: boolean;
  is_unknown: boolean;
  is_callback: boolean;
  is_schedule: boolean;
  is_blocklist: boolean;
}>): Promise<DbDispositionType> => {
  const { data, error } = await supabase
    .from("call_disposition_types")
    .update(params as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbDispositionType;
};

export const deleteDispositionType = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("call_disposition_types")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

/**
 * Sync RIVO disposition types to 3CPlus as a Qualification List.
 * Now includes extended properties (impact, behavior, flags).
 */
export interface SyncResult {
  dispositionMap: Record<string, number>;
  campaignsUpdated: number;
}

export const syncDispositionsTo3CPlus = async (tenantId: string): Promise<SyncResult | null> => {
  try {
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const settings = (tenantData?.settings as Record<string, any>) || {};
    const domain = settings.threecplus_domain;
    const apiToken = settings.threecplus_api_token;

    if (!domain || !apiToken) {
      logger.info("dispositionService", "syncDispositionsTo3CPlus", { message: "no 3CPlus credentials, skipping" });
      return null;
    }

    const types = await fetchTenantDispositionTypes(tenantId);

    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: {
        action: "sync_dispositions",
        domain,
        api_token: apiToken,
        dispositions: types.map(t => ({
          key: t.key, label: t.label, active: t.active,
          color: t.color, impact: t.impact, behavior: t.behavior,
          is_conversion: t.is_conversion, is_cpc: t.is_cpc,
          is_unknown: t.is_unknown, is_callback: t.is_callback,
          is_schedule: t.is_schedule, is_blocklist: t.is_blocklist,
          schedule_allow_other_number: t.schedule_allow_other_number,
          schedule_days_limit: t.schedule_days_limit,
          blocklist_mode: t.blocklist_mode,
          blocklist_days: t.blocklist_days,
          threecplus_qualification_id: (t as any).threecplus_qualification_id || null,
        })),
      },
    });

    if (error) {
      logger.error("dispositionService", "syncDispositionsTo3CPlus", error);
      return null;
    }

    const dispositionMap = data?.disposition_map as Record<string, number> | undefined;
    if (!dispositionMap) return null;

    const listId = data.list_id;

    const updatedSettings = {
      ...settings,
      threecplus_disposition_map: dispositionMap,
      threecplus_qualification_list_id: listId,
    };

    await supabase
      .from("tenants")
      .update({ settings: updatedSettings } as any)
      .eq("id", tenantId);

    // Auto-link qualification list to all campaigns
    let campaignsUpdated = 0;
    if (listId) {
      try {
        const { data: campaignsData } = await supabase.functions.invoke("threecplus-proxy", {
          body: { action: "list_campaigns", domain, api_token: apiToken },
        });
        const campaigns = Array.isArray(campaignsData) ? campaignsData : campaignsData?.data || [];
        for (const campaign of campaigns) {
          try {
            await supabase.functions.invoke("threecplus-proxy", {
              body: {
                action: "update_campaign",
                domain,
                api_token: apiToken,
                campaign_id: String(campaign.id),
                qualification_list: listId,
              },
            });
            campaignsUpdated++;
          } catch (e) {
            logger.error("dispositionService", "linkQualListToCampaign", { campaignId: campaign.id, error: e });
          }
        }
        logger.info("dispositionService", "syncDispositionsTo3CPlus", { campaignsUpdated });
      } catch (e) {
        logger.error("dispositionService", "listCampaignsForSync", e);
      }
    }

    logger.info("dispositionService", "syncDispositionsTo3CPlus", { count: Object.keys(dispositionMap).length, campaignsUpdated });
    return { dispositionMap, campaignsUpdated };
  } catch (err) {
    logger.error("dispositionService", "syncDispositionsTo3CPlus", err);
    return null;
  }
};

export type DispositionType = string;

export interface CustomDispositionType {
  key: string;
  label: string;
  color?: string;
  icon?: string;
  group?: string;
}

export const getDispositionTypes = (tenantSettings?: Record<string, any>): Record<string, string> => {
  const custom = tenantSettings?.custom_disposition_types as CustomDispositionType[] | undefined;
  if (custom && Array.isArray(custom) && custom.length > 0) {
    const map: Record<string, string> = {};
    for (const c of custom) map[c.key] = c.label;
    return map;
  }
  return DISPOSITION_TYPES;
};

export const getCustomDispositionList = (tenantSettings?: Record<string, any>): CustomDispositionType[] => {
  const custom = tenantSettings?.custom_disposition_types as CustomDispositionType[] | undefined;
  if (custom && Array.isArray(custom) && custom.length > 0) return custom;
  return Object.entries(DISPOSITION_TYPES).map(([key, label]) => ({ key, label }));
};

export const fetchDispositions = async (clientId: string): Promise<(CallDisposition & { operator_name?: string })[]> => {
  try {
    const { data, error } = await supabase
      .from("call_dispositions")
      .select("*, profiles:operator_id(full_name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      operator_name: d.profiles?.full_name || null,
      profiles: undefined,
    })) as (CallDisposition & { operator_name?: string })[];
  } catch (e) {
    console.warn("fetchDispositions join failed, falling back to basic select", e);
    const { data, error } = await supabase
      .from("call_dispositions")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as (CallDisposition & { operator_name?: string })[];
  }
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
 */
export const qualifyOn3CPlus = async (params: {
  dispositionType: string;
  tenantSettings: Record<string, any>;
  agentId: number;
  callId?: string | number;
}): Promise<boolean> => {
  try {
    const map = params.tenantSettings.threecplus_disposition_map as Record<string, number> | undefined;
    if (!map) {
      console.warn("qualifyOn3CPlus: no disposition map configured");
      return false;
    }
    const qualificationId = map[params.dispositionType];
    if (!qualificationId) {
      console.warn("qualifyOn3CPlus: no mapping for disposition type:", params.dispositionType);
      return false;
    }

    const domain = params.tenantSettings.threecplus_domain;
    const apiToken = params.tenantSettings.threecplus_api_token;
    if (!domain || !apiToken) return false;

    const callId = params.callId || sessionStorage.getItem("3cp_last_call_id");
    if (!callId) {
      console.warn("qualifyOn3CPlus: no callId available");
      return false;
    }

    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: {
        action: "qualify_call",
        domain,
        api_token: apiToken,
        agent_id: params.agentId,
        call_id: callId,
        qualification_id: qualificationId,
      },
    });

    if (error) {
      console.error("qualifyOn3CPlus invoke error:", error);
      return false;
    }

    // Check if 3CPlus returned an error status
    if (data?.status && data.status >= 400) {
      console.error("qualifyOn3CPlus 3CPlus error:", data.detail || data.message);
      return false;
    }

    console.log("qualifyOn3CPlus success for disposition:", params.dispositionType);
    return true;
  } catch (err) {
    console.error("qualifyOn3CPlus error (non-blocking):", err);
    return false;
  }
};

/**
 * Fetch recent call data from 3CPlus for the given agent and save to call_logs.
 */
export const saveCallLog = async (params: {
  tenantId: string;
  clientId: string;
  clientCpf: string;
  agentId: number;
  tenantSettings: Record<string, any>;
  operatorName?: string;
}): Promise<void> => {
  try {
    const domain = params.tenantSettings.threecplus_domain;
    const apiToken = params.tenantSettings.threecplus_api_token;
    if (!domain || !apiToken) return;

    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const formatDt = (d: Date) => d.toISOString().split("T")[0] + " " + d.toTimeString().split(" ")[0];

    const { data: reportData, error: reportError } = await supabase.functions.invoke("threecplus-proxy", {
      body: {
        action: "calls_report",
        domain,
        api_token: apiToken,
        agent_id: params.agentId,
        startDate: formatDt(thirtyMinAgo),
        endDate: formatDt(now),
      },
    });

    if (reportError) {
      console.error("saveCallLog: error fetching calls_report", reportError);
      return;
    }

    const calls = Array.isArray(reportData) ? reportData : (reportData?.data || reportData?.results || []);
    if (!Array.isArray(calls) || calls.length === 0) return;

    const latestCall = calls[0];

    const { error: insertError } = await supabase.from("call_logs" as any).insert({
      tenant_id: params.tenantId,
      client_id: params.clientId,
      client_cpf: params.clientCpf.replace(/\D/g, ""),
      phone: latestCall.phone || latestCall.destination || latestCall.phone_number || "",
      agent_name: params.operatorName || latestCall.agent_name || "",
      operator_id: String(params.agentId),
      call_id_external: String(latestCall.id || latestCall.call_id || ""),
      status: latestCall.status || latestCall.qualification || "unknown",
      duration_seconds: Number(latestCall.duration || latestCall.talk_time || 0),
      recording_url: latestCall.recording_url || latestCall.recording || latestCall.audio_url || null,
      campaign_name: latestCall.campaign_name || latestCall.campaign || "",
      called_at: latestCall.created_at || latestCall.start_time || new Date().toISOString(),
    } as any);

    if (insertError) {
      console.error("saveCallLog: error inserting call_log", insertError);
    }
  } catch (err) {
    console.error("saveCallLog error (non-blocking):", err);
  }
};
