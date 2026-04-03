import { supabase } from "@/integrations/supabase/client";
import { Client } from "@/services/clientService";

// ---- Types ----

export interface WhatsAppCampaign {
  id: string;
  tenant_id: string;
  source: string;
  channel_type: string;
  provider_category: string;
  campaign_type: string;
  status: string;
  message_mode: string;
  message_body: string | null;
  template_id: string | null;
  selected_instance_ids: string[];
  total_selected: number;
  total_unique_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  routing_mode: string;
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppCampaignRecipient {
  id: string;
  campaign_id: string;
  tenant_id: string;
  representative_client_id: string;
  phone: string;
  recipient_name: string;
  assigned_instance_id: string | null;
  status: string;
  error_message: string | null;
  message_body_snapshot: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EligibleInstance {
  id: string;
  name: string;
  instance_name: string;
  phone_number: string | null;
  provider: string;
  status: string;
  provider_category: string;
  is_default?: boolean;
  supports_manual_bulk?: boolean;
}

export interface DeduplicatedRecipient {
  phone: string;
  representativeClientId: string;
  recipientName: string;
}

// ---- Phone normalization ----

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function isValidPhone(normalized: string): boolean {
  return normalized.length >= 10 && normalized.length <= 15;
}

// ---- Deduplication ----

export function deduplicateClients(clients: Client[]): {
  recipients: DeduplicatedRecipient[];
  excludedCount: number;
} {
  const phoneMap = new Map<string, { clientId: string; name: string }>();
  let excludedCount = 0;

  for (const client of clients) {
    const normalized = normalizePhone(client.phone);
    if (!isValidPhone(normalized)) {
      excludedCount++;
      continue;
    }
    if (!phoneMap.has(normalized)) {
      phoneMap.set(normalized, {
        clientId: client.id,
        name: client.nome_completo,
      });
    }
  }

  const recipients: DeduplicatedRecipient[] = [];
  phoneMap.forEach((val, phone) => {
    recipients.push({
      phone,
      representativeClientId: val.clientId,
      recipientName: val.name,
    });
  });

  return { recipients, excludedCount };
}

// ---- Round-Robin distribution ----

export function distributeRoundRobin(
  recipients: DeduplicatedRecipient[],
  instanceIds: string[]
): (DeduplicatedRecipient & { assignedInstanceId: string })[] {
  const shuffled = [...recipients].sort(() => Math.random() - 0.5);
  return shuffled.map((r, i) => ({
    ...r,
    assignedInstanceId: instanceIds[i % instanceIds.length],
  }));
}

// ---- Fetch eligible instances (multi-provider: DB + Gupshup virtual) ----

export async function fetchEligibleInstances(tenantId: string): Promise<EligibleInstance[]> {
  const OPERATIONAL_STATUSES = ["active", "connected", "connecting", "open"];

  // 1) Fetch DB instances with capability fields (no strict status filter)
  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .select("id, name, instance_name, phone_number, provider, status, provider_category, is_default, supports_manual_bulk")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  // 2) Filter by eligibility: supports bulk AND (operational status OR is_default)
  const eligible = ((data || []) as unknown as EligibleInstance[]).filter((i) => {
    const hasOperationalStatus = OPERATIONAL_STATUSES.includes(i.status);
    const isBulkCapable = i.supports_manual_bulk !== false; // true or null (legacy)
    return isBulkCapable && (hasOperationalStatus || i.is_default);
  });

  // 3) Sort: default first, then connected/active, then others
  eligible.sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    const aConn = a.status === "active" || a.status === "connected" ? 0 : 1;
    const bConn = b.status === "active" || b.status === "connected" ? 0 : 1;
    return aConn - bConn;
  });

  // 4) Check tenant settings for Gupshup official
  try {
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenantId)
      .single();

    const settings = (tenantData?.settings as Record<string, any>) || {};
    const hasGupshup = !!(settings.gupshup_api_key && settings.gupshup_source_number);
    const isGupshupActive = settings.whatsapp_provider === "gupshup" || hasGupshup;

    if (isGupshupActive && hasGupshup) {
      eligible.push({
        id: "gupshup-official",
        name: `Gupshup (Oficial) — ${settings.gupshup_source_number}`,
        instance_name: settings.gupshup_app_name || "gupshup",
        phone_number: settings.gupshup_source_number,
        provider: "gupshup",
        status: "active",
        provider_category: "official_meta",
        is_default: false,
        supports_manual_bulk: true,
      });
    }
  } catch {
    // If tenant query fails, continue with DB instances only
  }

  return eligible;
}

// ---- Derive provider_category from selected instances ----

export function deriveProviderCategory(
  selectedInstanceIds: string[],
  allInstances: EligibleInstance[]
): string {
  const selected = allInstances.filter((i) => selectedInstanceIds.includes(i.id));
  if (selected.length === 0) return "unofficial";

  const allOfficial = selected.every((i) => i.provider_category === "official_meta");
  const allUnofficial = selected.every((i) => i.provider_category !== "official_meta");

  if (allOfficial) return "official_meta";
  if (allUnofficial) return "unofficial";
  return "mixed";
}

// ---- Campaign CRUD ----

export interface CreateCampaignInput {
  tenant_id: string;
  message_mode: "custom" | "template";
  message_body: string | null;
  template_id: string | null;
  selected_instance_ids: string[];
  total_selected: number;
  total_unique_recipients: number;
  created_by: string;
  provider_category?: string;
  name?: string;
}

export async function createCampaign(input: CreateCampaignInput): Promise<WhatsAppCampaign> {
  const { data, error } = await supabase
    .from("whatsapp_campaigns" as any)
    .insert({
      tenant_id: input.tenant_id,
      source: "carteira",
      channel_type: "whatsapp",
      provider_category: input.provider_category || "unofficial",
      campaign_type: "manual_human_outreach",
      status: "draft",
      message_mode: input.message_mode,
      message_body: input.message_body,
      template_id: input.template_id,
      selected_instance_ids: input.selected_instance_ids,
      total_selected: input.total_selected,
      total_unique_recipients: input.total_unique_recipients,
      created_by: input.created_by,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as WhatsAppCampaign;
}

export async function createRecipients(
  campaignId: string,
  tenantId: string,
  recipients: (DeduplicatedRecipient & { assignedInstanceId: string })[],
  messageBody: string
): Promise<void> {
  const rows = recipients.map((r) => ({
    campaign_id: campaignId,
    tenant_id: tenantId,
    representative_client_id: r.representativeClientId,
    phone: r.phone,
    recipient_name: r.recipientName,
    assigned_instance_id: r.assignedInstanceId === "gupshup-official" ? null : r.assignedInstanceId,
    status: "pending",
    message_body_snapshot: messageBody,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("whatsapp_campaign_recipients" as any)
      .insert(batch as any);
    if (error) throw error;
  }
}

export async function startCampaign(campaignId: string): Promise<any> {
  const { data, error } = await supabase.functions.invoke("send-bulk-whatsapp", {
    body: { campaign_id: campaignId },
  });
  if (error) throw error;
  return data;
}

export async function fetchCampaigns(tenantId: string): Promise<WhatsAppCampaign[]> {
  const { data, error } = await supabase
    .from("whatsapp_campaigns" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as WhatsAppCampaign[];
}

export async function fetchCampaignRecipients(campaignId: string): Promise<WhatsAppCampaignRecipient[]> {
  const { data, error } = await supabase
    .from("whatsapp_campaign_recipients" as any)
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as WhatsAppCampaignRecipient[];
}

export async function fetchCampaignById(campaignId: string): Promise<WhatsAppCampaign | null> {
  const { data, error } = await supabase
    .from("whatsapp_campaigns" as any)
    .select("*")
    .eq("id", campaignId)
    .single();
  if (error) return null;
  return data as unknown as WhatsAppCampaign;
}
