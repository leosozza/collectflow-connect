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
  totalResponded: number;
  totalAgreements: number;
  responseRate: number;
  agreementRate: number;
}

export interface InstanceMetric {
  instance_id: string;
  instance_name: string;
  recipients: number;
  sent: number;
  failed: number;
  delivered: number;
}

// ---- Fetch campaigns list ----

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
  }
): Promise<CampaignWithStats[]> {
  let query = supabase
    .from("whatsapp_campaigns" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

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

  const { data, error } = await query;
  if (error) throw error;

  const campaigns = (data || []) as unknown as CampaignWithStats[];

  // Enrich with creator names
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

  return campaigns;
}

// ---- Dashboard stats ----

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
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0);
  const totalFailed = campaigns.reduce((s, c) => s + (c.failed_count || 0), 0);

  // For responded/agreements we'd need recipient-level data; approximate from delivered
  return {
    totalCampaigns,
    totalSent,
    totalDelivered,
    totalFailed,
    totalResponded: 0, // Will be calculated per-campaign in detail view
    totalAgreements: 0,
    responseRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
    agreementRate: 0,
  };
}

// ---- Campaign detail ----

export async function fetchCampaignDetail(campaignId: string): Promise<CampaignWithStats | null> {
  const { data, error } = await supabase
    .from("whatsapp_campaigns" as any)
    .select("*")
    .eq("id", campaignId)
    .single();

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

// ---- Campaign recipients ----

export async function fetchManagedRecipients(
  campaignId: string,
  filters?: {
    status?: string;
    instanceId?: string;
    hasError?: boolean;
  }
): Promise<CampaignRecipientWithClient[]> {
  let query = supabase
    .from("whatsapp_campaign_recipients" as any)
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.instanceId && filters.instanceId !== "all") {
    query = query.eq("assigned_instance_id", filters.instanceId);
  }
  if (filters?.hasError) {
    query = query.not("error_message", "is", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const recipients = (data || []) as unknown as CampaignRecipientWithClient[];

  // Enrich with client data
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

  // Enrich with instance names
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

  return recipients;
}

// ---- Campaign agreements (indirect: recipient → client → cpf → agreements) ----

export async function fetchCampaignAgreements(campaignId: string, tenantId: string) {
  // Get recipients with client CPFs
  const recipients = await fetchManagedRecipients(campaignId);
  const cpfs = [...new Set(recipients.map((r) => r.client_cpf).filter(Boolean))] as string[];
  if (cpfs.length === 0) return [];

  // Get campaign start date
  const campaign = await fetchCampaignDetail(campaignId);
  const startDate = campaign?.started_at || campaign?.created_at;

  // Fetch agreements for these CPFs created after campaign start
  let query = supabase
    .from("agreements")
    .select("id, client_cpf, client_name, credor, proposed_total, original_total, status, created_at, created_by")
    .eq("tenant_id", tenantId);

  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  const { data, error } = await query;
  if (error) return [];

  // Filter to only CPFs from the campaign (normalize for comparison)
  const normalizedCpfs = new Set(cpfs.map((c) => c.replace(/\D/g, "")));
  const agreements = (data || []).filter((a: any) =>
    normalizedCpfs.has(a.client_cpf?.replace(/\D/g, "") || "")
  );

  // Enrich with creator names
  const creatorIds = [...new Set(agreements.map((a: any) => a.created_by).filter(Boolean))];
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", creatorIds);
    const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
    agreements.forEach((a: any) => {
      a.creator_name = nameMap.get(a.created_by) || "—";
    });
  }

  return agreements;
}

// ---- Instance metrics ----

export async function fetchInstanceMetrics(campaignId: string): Promise<InstanceMetric[]> {
  const recipients = await fetchManagedRecipients(campaignId);

  const metricMap = new Map<string, InstanceMetric>();

  for (const r of recipients) {
    const key = r.assigned_instance_id || "unassigned";
    if (!metricMap.has(key)) {
      metricMap.set(key, {
        instance_id: key,
        instance_name: r.instance_name || "Sem instância",
        recipients: 0,
        sent: 0,
        failed: 0,
        delivered: 0,
      });
    }
    const m = metricMap.get(key)!;
    m.recipients++;
    if (r.status === "sent" || r.status === "delivered" || r.status === "read") m.sent++;
    if (r.status === "failed") m.failed++;
    if (r.status === "delivered" || r.status === "read") m.delivered++;
  }

  return Array.from(metricMap.values());
}

// ---- Responses: recipients that got a reply (conversation created after campaign) ----

export async function fetchCampaignResponses(campaignId: string, tenantId: string) {
  const recipients = await fetchManagedRecipients(campaignId);
  const campaign = await fetchCampaignDetail(campaignId);
  const startDate = campaign?.started_at || campaign?.created_at;

  // Get all conversations for tenant after start
  let convQuery = supabase
    .from("conversations")
    .select("id, phone, status, assigned_to, created_at, client_id")
    .eq("tenant_id", tenantId);

  if (startDate) {
    convQuery = convQuery.gte("created_at", startDate);
  }

  const { data: conversations } = await convQuery;

  // Build phone→conversation map (normalize phones)
  const convByPhone = new Map<string, any>();
  for (const conv of (conversations || []) as any[]) {
    const normalized = conv.phone?.replace(/\D/g, "") || "";
    if (normalized) {
      convByPhone.set(normalized, conv);
    }
  }

  // Match recipients to conversations
  const responses = recipients
    .map((r) => {
      const normalized = r.phone?.replace(/\D/g, "") || "";
      const conv = convByPhone.get(normalized);
      if (!conv) return null;
      return {
        ...r,
        conversation_id: conv.id,
        conversation_status: conv.status,
        conversation_assigned_to: conv.assigned_to,
        responded_at: conv.created_at,
      };
    })
    .filter(Boolean);

  return responses;
}
