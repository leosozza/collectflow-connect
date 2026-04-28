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
  origin_type?: string;
  progress_metadata?: Record<string, any> | null;
  instance_weights?: { instanceId: string; weight: number }[] | null;
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

export interface CampaignProgress {
  status: string;
  sent_count: number;
  failed_count: number;
  total_unique_recipients: number;
  progress_metadata: Record<string, any> | null;
}

// ---- Phone normalization ----

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function isValidPhone(normalized: string): boolean {
  if (normalized.length < 10 || normalized.length > 15) return false;
  // Reject all-same-digit (e.g., 00000000000, 11111111111)
  if (/^(\d)\1+$/.test(normalized)) return false;
  // Reject numbers starting with 0 (invalid Brazilian/E.164)
  if (normalized.startsWith("0")) return false;
  // Reject numbers composed only of 0s and 1s (placeholders like 01010101010)
  if (/^[01]+$/.test(normalized)) return false;
  return true;
}

/**
 * Filter out CPFs whose phones were previously confirmed as not having WhatsApp.
 * Reads `client_profiles.phone_has_whatsapp` for the tenant and excludes matches.
 * Returns the filtered client list and how many were excluded.
 */
export async function filterClientsWithoutWhatsApp<T extends { cpf: string }>(
  supabaseClient: any,
  tenantId: string,
  clients: T[],
): Promise<{ clients: T[]; excludedNoWhatsApp: number }> {
  if (!clients || clients.length === 0) return { clients: [], excludedNoWhatsApp: 0 };
  try {
    const cpfs = Array.from(new Set(clients.map((c) => c.cpf).filter(Boolean)));
    if (cpfs.length === 0) return { clients, excludedNoWhatsApp: 0 };
    const { data } = await supabaseClient
      .from("client_profiles")
      .select("cpf, phone_has_whatsapp")
      .eq("tenant_id", tenantId)
      .eq("phone_has_whatsapp", false)
      .in("cpf", cpfs);
    const invalidCpfs = new Set<string>(((data || []) as any[]).map((r) => r.cpf));
    if (invalidCpfs.size === 0) return { clients, excludedNoWhatsApp: 0 };
    const filtered = clients.filter((c) => !invalidCpfs.has(c.cpf));
    return { clients: filtered, excludedNoWhatsApp: clients.length - filtered.length };
  } catch {
    return { clients, excludedNoWhatsApp: 0 };
  }
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

// ---- Weighted distribution ----
// Distributes recipients across instances by integer percentage weights.
// Input weights must sum to 100. The function rounds per-instance counts,
// then adjusts the largest bucket so total matches recipients.length.
// Output is finally shuffled to interleave sends between instances.

export interface InstanceWeight {
  instanceId: string;
  weight: number; // 0-100, integer
}

export function distributeWeighted(
  recipients: DeduplicatedRecipient[],
  weights: InstanceWeight[]
): (DeduplicatedRecipient & { assignedInstanceId: string })[] {
  const total = recipients.length;
  if (total === 0 || weights.length === 0) return [];

  const sumWeights = weights.reduce((s, w) => s + (w.weight || 0), 0);
  if (sumWeights <= 0) {
    // fallback to round-robin if weights are invalid
    return distributeRoundRobin(
      recipients,
      weights.map((w) => w.instanceId)
    );
  }

  // Compute per-instance counts
  const counts = weights.map((w) => ({
    instanceId: w.instanceId,
    count: Math.floor((total * w.weight) / sumWeights),
  }));
  let assigned = counts.reduce((s, c) => s + c.count, 0);
  // Distribute leftover to largest weighted bucket(s) in order
  const sortedByWeight = [...weights]
    .map((w, idx) => ({ idx, weight: w.weight }))
    .sort((a, b) => b.weight - a.weight);
  let i = 0;
  while (assigned < total) {
    counts[sortedByWeight[i % sortedByWeight.length].idx].count += 1;
    assigned += 1;
    i += 1;
  }

  // Shuffle source recipients first
  const shuffled = [...recipients].sort(() => Math.random() - 0.5);
  const result: (DeduplicatedRecipient & { assignedInstanceId: string })[] = [];
  let cursor = 0;
  for (const c of counts) {
    for (let k = 0; k < c.count; k++) {
      result.push({ ...shuffled[cursor], assignedInstanceId: c.instanceId });
      cursor += 1;
    }
  }
  // Re-shuffle to avoid bursts from a single instance
  return result.sort(() => Math.random() - 0.5);
}

// ---- Fetch eligible instances (multi-provider: DB + Gupshup virtual) ----

export async function fetchEligibleInstances(
  tenantId: string,
  opts?: { profileId?: string; isAdmin?: boolean }
): Promise<EligibleInstance[]> {
  const OPERATIONAL_STATUSES = ["active", "connected", "connecting", "open"];

  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .select("id, name, instance_name, phone_number, provider, status, provider_category, is_default, supports_manual_bulk")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  let eligible = ((data || []) as unknown as EligibleInstance[]).filter((i) => {
    const hasOperationalStatus = OPERATIONAL_STATUSES.includes(i.status);
    const isBulkCapable = i.supports_manual_bulk !== false;
    return isBulkCapable && (hasOperationalStatus || i.is_default);
  });

  // Operator-level filtering: restrict to instances assigned via operator_instances
  const isOperatorScope = opts && opts.isAdmin === false && !!opts.profileId;
  if (isOperatorScope) {
    const { data: assignments, error: assignErr } = await supabase
      .from("operator_instances" as any)
      .select("instance_id")
      .eq("profile_id", opts!.profileId!)
      .eq("tenant_id", tenantId);
    if (assignErr) throw assignErr;
    const allowed = new Set((assignments || []).map((a: any) => a.instance_id));
    eligible = eligible.filter((i) => allowed.has(i.id));
  }

  eligible.sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    const aConn = a.status === "active" || a.status === "connected" ? 0 : 1;
    const bConn = b.status === "active" || b.status === "connected" ? 0 : 1;
    return aConn - bConn;
  });

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

/**
 * Check if the selected instances mix official and unofficial providers.
 * Mixed campaigns are not allowed — they must be separate.
 */
export function isMixedProviderSelection(
  selectedInstanceIds: string[],
  allInstances: EligibleInstance[]
): boolean {
  return deriveProviderCategory(selectedInstanceIds, allInstances) === "mixed";
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
  instance_weights?: InstanceWeight[] | null;
  scheduled_for?: string | null;
  schedule_type?: "once" | "recurring";
  recurrence_rule?: Record<string, any> | null;
}

export async function createCampaign(input: CreateCampaignInput): Promise<WhatsAppCampaign> {
  const isScheduled = !!input.scheduled_for;
  const { data, error } = await supabase
    .from("whatsapp_campaigns" as any)
    .insert({
      tenant_id: input.tenant_id,
      source: "carteira",
      channel_type: "whatsapp",
      provider_category: input.provider_category || "unofficial",
      campaign_type: "manual_human_outreach",
      status: isScheduled ? "scheduled" : "draft",
      message_mode: input.message_mode,
      message_body: input.message_body,
      template_id: input.template_id,
      selected_instance_ids: input.selected_instance_ids,
      total_selected: input.total_selected,
      total_unique_recipients: input.total_unique_recipients,
      created_by: input.created_by,
      name: input.name || `Disparo Carteira ${new Date().toLocaleDateString("pt-BR")}`,
      origin_type: "OP_CARTEIRA",
      instance_weights: input.instance_weights ?? null,
      scheduled_for: input.scheduled_for ?? null,
      schedule_type: input.schedule_type || "once",
      recurrence_rule: input.recurrence_rule ?? null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as WhatsAppCampaign;
}

// ---- Scheduled campaign management ----

export async function cancelScheduledCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns" as any)
    .update({ status: "cancelled", scheduled_for: null })
    .eq("id", campaignId)
    .in("status", ["scheduled", "paused"]);
  if (error) throw error;

  await supabase
    .from("whatsapp_campaign_recipients" as any)
    .update({ status: "cancelled" })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
}

export async function pauseRecurringCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns" as any)
    .update({ status: "paused" })
    .eq("id", campaignId)
    .eq("status", "scheduled");
  if (error) throw error;
}

export async function resumeRecurringCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns" as any)
    .update({ status: "scheduled" })
    .eq("id", campaignId)
    .eq("status", "paused");
  if (error) throw error;
}

export async function rescheduleCampaign(
  campaignId: string,
  newScheduledFor: string
): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns" as any)
    .update({ scheduled_for: newScheduledFor, status: "scheduled" })
    .eq("id", campaignId);
  if (error) throw error;
}

export async function updateRecurrenceRule(
  campaignId: string,
  newRule: Record<string, any>,
  nextScheduledFor: string
): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns" as any)
    .update({ recurrence_rule: newRule, scheduled_for: nextScheduledFor })
    .eq("id", campaignId);
  if (error) throw error;
}

export async function fireNowScheduledCampaign(campaignId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns" as any)
    .update({ scheduled_for: new Date().toISOString(), status: "scheduled" })
    .eq("id", campaignId)
    .in("status", ["scheduled", "paused"]);
  if (error) throw error;
}

export async function fetchCampaignRuns(parentCampaignId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("whatsapp_campaign_runs" as any)
    .select("*")
    .eq("parent_campaign_id", parentCampaignId)
    .order("run_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any[];
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

// ---- Start campaign with auto-resume for partial completions ----

export async function startCampaign(campaignId: string): Promise<void> {
  // Fire-and-forget: invoke but don't await the full response.
  // The edge function may take minutes (anti-ban delays), causing client-side timeouts.
  // The function continues running server-side regardless.
  supabase.functions.invoke("send-bulk-whatsapp", {
    body: { campaign_id: campaignId },
  }).catch((err) => {
    console.warn("[startCampaign] invoke returned error (expected for long campaigns):", err?.message);
  });
}

// ---- Poll campaign progress (for real-time UI updates) ----

export async function pollCampaignProgress(campaignId: string): Promise<CampaignProgress | null> {
  const { data, error } = await supabase
    .from("whatsapp_campaigns" as any)
    .select("status, sent_count, failed_count, total_unique_recipients, progress_metadata")
    .eq("id", campaignId)
    .single();

  if (error || !data) return null;

  return {
    status: (data as any).status,
    sent_count: (data as any).sent_count || 0,
    failed_count: (data as any).failed_count || 0,
    total_unique_recipients: (data as any).total_unique_recipients || 0,
    progress_metadata: (data as any).progress_metadata || null,
  };
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

// ---- Template resolver (frontend mirror of supabase/functions/_shared/template-resolver.ts) ----

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function resolveTemplateClient(
  template: string,
  client: Record<string, any>
): string {
  if (!template) return "";

  const nome = client.nome_completo || client.recipient_name || "";
  const cpf = client.cpf || "";
  const valorParcela = brlFormatter.format(Number(client.valor_parcela) || 0);
  const dataVencimento = client.data_vencimento
    ? new Date(String(client.data_vencimento) + "T12:00:00").toLocaleDateString("pt-BR")
    : "";
  const credor = client.credor || "";

  return template
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{cpf\}\}/g, cpf)
    .replace(/\{\{valor_parcela\}\}/g, valorParcela)
    .replace(/\{\{valor\}\}/g, valorParcela)
    .replace(/\{\{data_vencimento\}\}/g, dataVencimento)
    .replace(/\{\{credor\}\}/g, credor);
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

// ---- Recurrence: compute next run (frontend mirror of edge logic) ----
// Timezone fixed at America/Sao_Paulo (UTC-3, no DST post-2019).

export interface RecurrenceRuleFE {
  frequency: "daily" | "weekly" | "monthly";
  time: string; // HH:MM
  weekdays?: number[];
  day_of_month?: number;
  window_start?: string;
  window_end?: string;
  end_at?: string | null;
  max_runs?: number | null;
  skip_weekends?: boolean;
  timezone?: string;
}

export function computeNextRunClient(rule: RecurrenceRuleFE, fromIso?: string): string | null {
  const TZ_OFFSET_MIN = -180;
  const [hh, mm] = (rule.time || "08:00").split(":").map((x) => parseInt(x, 10));
  const from = fromIso ? new Date(fromIso) : new Date();

  const localFromMs = from.getTime() + TZ_OFFSET_MIN * 60000;
  const localFrom = new Date(localFromMs);

  let candidate = new Date(localFromMs);
  candidate.setUTCHours(hh, mm, 0, 0);
  if (candidate <= localFrom) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  for (let i = 0; i < 370; i++) {
    const day = candidate.getUTCDay();
    const skipW = rule.skip_weekends && (day === 0 || day === 6);
    let matches = false;
    if (!skipW) {
      if (rule.frequency === "daily") matches = true;
      else if (rule.frequency === "weekly") {
        const wds = rule.weekdays && rule.weekdays.length > 0 ? rule.weekdays : [1, 2, 3, 4, 5];
        matches = wds.includes(day);
      } else if (rule.frequency === "monthly") {
        // Allow 1-31; when the month has fewer days, use the last day of the month.
        const requested = Math.min(Math.max(rule.day_of_month || 1, 1), 31);
        const year = candidate.getUTCFullYear();
        const month = candidate.getUTCMonth();
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const dom = Math.min(requested, daysInMonth);
        matches = candidate.getUTCDate() === dom;
      }
    }
    if (matches) {
      const utcMs = candidate.getTime() - TZ_OFFSET_MIN * 60000;
      const next = new Date(utcMs);
      if (rule.end_at && next > new Date(rule.end_at)) return null;
      return next.toISOString();
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return null;
}
