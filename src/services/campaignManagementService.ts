import { supabase } from "@/integrations/supabase/client";

// ---- Types ----

export interface CampaignWithStats {
  id: string;
  tenant_id: string;
  name: string | null;
  description: string | null;
  source: string;
  origin_type: string | null;
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
  creator_name?: string;
}

export interface CampaignRecipientWithClient {
  id: string;
  phone: string;
  recipient_name: string;
  assigned_instance_id: string | null;
  status: string;
  error_message: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  representative_client_id: string;
  client_cpf?: string;
  client_score?: number | null;
  client_profile?: string | null;
  client_status?: string | null;
  instance_name?: string;
}

export interface CampaignDashboardStats {
  totalCampaigns: number;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
}

export interface InstanceMetric {
  instance_id: string;
  instance_name: string;
  recipients: number;
  sent: number;
  failed: number;
  delivered: number;
}

export interface RecipientStatusCount {
  status: string;
  count: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Fetch campaigns list (paginated, limit 100) ----

export async function fetchManagedCampaigns(
  tenantId: string,
  filters?: {
    status?: string;
    origin_type?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    createdBy?: string;
    onlyOwn?: boolean;
    userId?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<PaginatedResult<CampaignWithStats>> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("whatsapp_campaigns" as any)
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.origin_type && filters.origin_type !== "all") {
    query = query.eq("origin_type", filters.origin_type);
  }
  if (filters?.createdBy) {
    query = query.eq("created_by", filters.createdBy);
  }
  if (filters?.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("created_at", filters.dateTo + "T23:59:59");
  }
  if (filters?.onlyOwn && filters?.userId) {
    query = query.eq("created_by", filters.userId);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const campaigns = (data || []) as unknown as CampaignWithStats[];

  // Enrich with creator names in batch
  const creatorIds = [...new Set(campaigns.map((c) => c.created_by).filter(Boolean))];
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", creatorIds);

    const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
    campaigns.forEach((c) => {
      c.creator_name = nameMap.get(c.created_by) || "—";
    });
  }

  return { data: campaigns, total: count || 0, page, pageSize };
}

// ---- Dashboard stats (honest — no fake response/agreement rates) ----

export async function fetchCampaignDashboardStats(
  tenantId: string,
  userId?: string
): Promise<CampaignDashboardStats> {
  let query = supabase
    .from("whatsapp_campaigns" as any)
    .select("id, sent_count, delivered_count, failed_count, status")
    .eq("tenant_id", tenantId);

  if (userId) {
    query = query.eq("created_by", userId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const campaigns = (data || []) as any[];

  return {
    totalCampaigns: campaigns.length,
    totalSent: campaigns.reduce((s, c) => s + (c.sent_count || 0), 0),
    totalDelivered: campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0),
    totalFailed: campaigns.reduce((s, c) => s + (c.failed_count || 0), 0),
  };
}

// ---- Campaign detail (with tenant + ownership protection) ----

export async function fetchCampaignDetail(
  campaignId: string,
  tenantId?: string,
  options?: { onlyOwn?: boolean; userId?: string }
): Promise<CampaignWithStats | null> {
  let query = supabase
    .from("whatsapp_campaigns" as any)
    .select("*")
    .eq("id", campaignId);

  // Tenant protection
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  // Ownership protection
  if (options?.onlyOwn && options?.userId) {
    query = query.eq("created_by", options.userId);
  }

  const { data, error } = await query.single();
  if (error) return null;

  const campaign = data as unknown as CampaignWithStats;

  // Enrich creator name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", campaign.created_by)
    .single();

  campaign.creator_name = profile?.full_name || "—";
  return campaign;
}

// ---- Campaign recipients (paginated) ----

export async function fetchManagedRecipients(
  campaignId: string,
  filters?: {
    status?: string;
    instanceId?: string;
    hasError?: boolean;
  },
  page = 1,
  pageSize = 50
): Promise<PaginatedResult<CampaignRecipientWithClient>> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("whatsapp_campaign_recipients" as any)
    .select("*", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.instanceId && filters.instanceId !== "all") {
    query = query.eq("assigned_instance_id", filters.instanceId);
  }
  if (filters?.hasError) {
    query = query.not("error_message", "is", null);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  const recipients = (data || []) as unknown as CampaignRecipientWithClient[];

  // Enrich with client data in batch
  const clientIds = [...new Set(recipients.map((r) => r.representative_client_id).filter(Boolean))];
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, cpf, propensity_score, debtor_profile, status")
      .in("id", clientIds);

    const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));
    recipients.forEach((r) => {
      const cl = clientMap.get(r.representative_client_id);
      if (cl) {
        r.client_cpf = cl.cpf;
        r.client_score = cl.propensity_score;
        r.client_profile = cl.debtor_profile;
        r.client_status = cl.status;
      }
    });
  }

  // Enrich with instance names in batch
  const instanceIds = [...new Set(recipients.map((r) => r.assigned_instance_id).filter(Boolean))];
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("whatsapp_instances" as any)
      .select("id, name")
      .in("id", instanceIds);

    const instMap = new Map(((instances || []) as any[]).map((i) => [i.id, i.name]));
    recipients.forEach((r) => {
      if (r.assigned_instance_id) {
        r.instance_name = instMap.get(r.assigned_instance_id) || "—";
      }
    });
  }

  return { data: recipients, total: count || 0, page, pageSize };
}

// ---- Recipient status counts (lightweight — no full load) ----

export async function fetchRecipientStatusCounts(campaignId: string): Promise<RecipientStatusCount[]> {
  const { data, error } = await supabase
    .from("whatsapp_campaign_recipients" as any)
    .select("status")
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const r of (data || []) as any[]) {
    const s = r.status || "pending";
    counts[s] = (counts[s] || 0) + 1;
  }

  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}

// ---- Instance metrics (direct GROUP BY — no N+1) ----

export async function fetchInstanceMetrics(campaignId: string): Promise<InstanceMetric[]> {
  // Get all recipients with only the fields we need
  const { data: rawRecipients, error } = await supabase
    .from("whatsapp_campaign_recipients" as any)
    .select("assigned_instance_id, status")
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const recipients = (rawRecipients || []) as any[];

  // Aggregate manually (avoids loading full recipient objects)
  const metricMap = new Map<string, InstanceMetric>();

  for (const r of recipients) {
    const key = r.assigned_instance_id || "unassigned";
    if (!metricMap.has(key)) {
      metricMap.set(key, {
        instance_id: key,
        instance_name: "—",
        recipients: 0,
        sent: 0,
        failed: 0,
        delivered: 0,
      });
    }
    const m = metricMap.get(key)!;
    m.recipients++;
    if (["sent", "delivered", "read"].includes(r.status)) m.sent++;
    if (r.status === "failed") m.failed++;
    if (["delivered", "read"].includes(r.status)) m.delivered++;
  }

  // Enrich instance names in single batch query
  const instanceIds = [...metricMap.keys()].filter((k) => k !== "unassigned");
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("whatsapp_instances" as any)
      .select("id, name")
      .in("id", instanceIds);

    for (const inst of (instances || []) as any[]) {
      const m = metricMap.get(inst.id);
      if (m) m.instance_name = inst.name;
    }
  }

  const unassigned = metricMap.get("unassigned");
  if (unassigned) unassigned.instance_name = "Sem instância";

  return Array.from(metricMap.values());
}

// ---- Fetch campaign instances (for filter dropdowns) ----

export async function fetchCampaignInstances(
  selectedInstanceIds: string[]
): Promise<{ id: string; name: string }[]> {
  if (!selectedInstanceIds || selectedInstanceIds.length === 0) return [];

  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .select("id, name")
    .in("id", selectedInstanceIds);

  if (error) return [];
  return (data || []) as any[];
}

// ---- Campaign agreements (optimized — no N+1, 30-day window) ----
// LIMITATION: correlation by CPF + time window, not causal link

export async function fetchCampaignAgreements(
  campaignId: string,
  tenantId: string,
  campaignStartDate?: string
) {
  // If no start date provided, fetch campaign to get it
  let startDate = campaignStartDate;
  if (!startDate) {
    const { data: cData } = await supabase
      .from("whatsapp_campaigns" as any)
      .select("started_at, created_at")
      .eq("id", campaignId)
      .single();
    const cd = cData as any;
    startDate = cd?.started_at || cd?.created_at;
  }

  if (!startDate) return [];

  // Calculate 30-day window
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);

  // Get CPFs directly from recipients + clients (no full enrichment)
  const { data: recipientClients } = await supabase
    .from("whatsapp_campaign_recipients" as any)
    .select("representative_client_id")
    .eq("campaign_id", campaignId);

  const clientIds = [...new Set(
    ((recipientClients || []) as any[])
      .map((r) => r.representative_client_id)
      .filter(Boolean)
  )];

  if (clientIds.length === 0) return [];

  const { data: clients } = await supabase
    .from("clients")
    .select("cpf")
    .in("id", clientIds);

  const cpfs = [...new Set(((clients || []) as any[]).map((c) => c.cpf).filter(Boolean))];
  if (cpfs.length === 0) return [];

  const normalizedCpfs = new Set(cpfs.map((c: string) => c.replace(/\D/g, "")));

  // Fetch agreements within 30-day window, exclude portal_origin and rejected (limit 200)
  const { data: agreements, error } = await supabase
    .from("agreements")
    .select("id, client_cpf, client_name, credor, proposed_total, original_total, status, created_at, created_by, portal_origin")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate)
    .lte("created_at", endDate.toISOString())
    .neq("status", "rejected")
    .neq("portal_origin", true)
    .order("created_at", { ascending: false })
    .range(0, 199);

  if (error) return [];

  // Filter to only CPFs from the campaign
  const filtered = (agreements || []).filter((a: any) =>
    normalizedCpfs.has(a.client_cpf?.replace(/\D/g, "") || "")
  );

  // Enrich with creator names in batch
  const creatorIds = [...new Set(filtered.map((a: any) => a.created_by).filter(Boolean))];
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", creatorIds);
    const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
    filtered.forEach((a: any) => {
      a.creator_name = nameMap.get(a.created_by) || "—";
    });
  }

  return filtered;
}

// ---- Responses: recipients with inbound messages in time window ----
// LIMITATION: correlation by phone + time window, not causal link

export async function fetchCampaignResponses(campaignId: string, tenantId: string) {
  // Fetch campaign dates
  const { data: cRaw } = await supabase
    .from("whatsapp_campaigns" as any)
    .select("started_at, created_at, completed_at")
    .eq("id", campaignId)
    .single();

  const cData = cRaw as any;
  const startDate = cData?.started_at || cData?.created_at;
  if (!startDate) return [];

  // Time window: started_at to completed_at + 72h (or started_at + 7 days)
  let endDate: Date;
  if (cData?.completed_at) {
    endDate = new Date(cData.completed_at);
    endDate.setHours(endDate.getHours() + 72);
  } else {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  }

  // Get recipient phones (lightweight)
  const { data: recipientData } = await supabase
    .from("whatsapp_campaign_recipients" as any)
    .select("id, phone, recipient_name, assigned_instance_id, status")
    .eq("campaign_id", campaignId)
    .range(0, 999);

  const recipients = (recipientData || []) as any[];
  if (recipients.length === 0) return [];

  // Normalize phones for lookup
  const phoneMap = new Map<string, any>();
  for (const r of recipients) {
    const normalized = r.phone?.replace(/\D/g, "") || "";
    if (normalized) phoneMap.set(normalized, r);
  }

  // Find conversations with matching remote_phone in the time window
  const { data: conversations } = await supabase
    .from("conversations" as any)
    .select("id, remote_phone, status, assigned_to, created_at, client_id")
    .eq("tenant_id", tenantId)
    .gte("created_at", startDate)
    .lte("created_at", endDate.toISOString())
    .range(0, 499);

  if (!conversations || conversations.length === 0) return [];

  // Match conversations to recipients by normalized phone
  const matchedConvIds: string[] = [];
  const convRecipientMap = new Map<string, { conv: any; recipient: any }>();

  for (const conv of conversations as any[]) {
    const normalized = conv.remote_phone?.replace(/\D/g, "") || "";
    const recipient = phoneMap.get(normalized);
    if (!recipient) continue;
    matchedConvIds.push(conv.id);
    convRecipientMap.set(conv.id, { conv, recipient });
  }

  if (matchedConvIds.length === 0) return [];

  // Verify real inbound messages exist in these conversations (eliminates system-only convos)
  const { data: inboundMessages } = await supabase
    .from("chat_messages" as any)
    .select("conversation_id")
    .in("conversation_id", matchedConvIds)
    .eq("direction", "inbound")
    .gte("created_at", startDate)
    .lte("created_at", endDate.toISOString());

  const convsWithInbound = new Set(((inboundMessages || []) as any[]).map((m) => m.conversation_id));

  // Build responses only for conversations with real inbound messages
  const responses: any[] = [];
  for (const convId of convsWithInbound) {
    const match = convRecipientMap.get(convId);
    if (!match) continue;
    responses.push({
      ...match.recipient,
      conversation_id: match.conv.id,
      conversation_status: match.conv.status,
      conversation_assigned_to: match.conv.assigned_to,
      responded_at: match.conv.created_at,
    });
  }

  // Enrich instance names
  const instanceIds = [...new Set(responses.map((r) => r.assigned_instance_id).filter(Boolean))];
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("whatsapp_instances" as any)
      .select("id, name")
      .in("id", instanceIds);

    const instMap = new Map(((instances || []) as any[]).map((i) => [i.id, i.name]));
    responses.forEach((r) => {
      r.instance_name = instMap.get(r.assigned_instance_id) || "—";
    });
  }

  return responses.slice(0, 200);
}
