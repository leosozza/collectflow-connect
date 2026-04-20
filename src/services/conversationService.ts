import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  id: string;
  tenant_id: string;
  instance_id: string;
  remote_phone: string;
  remote_name: string;
  remote_avatar_url?: string | null;
  remote_avatar_fetched_at?: string | null;
  status: "open" | "waiting" | "closed";
  assigned_to: string | null;
  last_message_at: string;
  last_interaction_at?: string | null;
  unread_count: number;
  client_id: string | null;
  client_name?: string;
  last_message_content?: string;
  last_message_type?: string;
  last_message_direction?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  tenant_id: string;
  direction: "inbound" | "outbound";
  message_type: "text" | "image" | "audio" | "video" | "document" | "sticker";
  content: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  external_id: string | null;
  is_internal: boolean;
  reply_to_message_id: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface QuickReply {
  id: string;
  tenant_id: string;
  shortcut: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationFilters {
  statusFilter?: string;
  instanceFilter?: string;
  operatorFilter?: string;
  search?: string;
  unreadOnly?: boolean;
  dispositionFilter?: string;
}

export async function fetchQuickReplies(tenantId: string): Promise<QuickReply[]> {
  const { data, error } = await supabase
    .from("quick_replies" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("shortcut");
  if (error) throw error;
  return (data || []) as unknown as QuickReply[];
}

export async function sendInternalNote(
  conversationId: string,
  tenantId: string,
  content: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages" as any)
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: "outbound",
      message_type: "text",
      content,
      status: "delivered",
      is_internal: true,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ChatMessage;
}

export async function fetchConversations(
  tenantId: string,
  page = 1,
  pageSize = 30,
  filters: ConversationFilters = {},
  isAdmin = false
): Promise<{ data: Conversation[]; count: number }> {
  // Operadores não-admin: usar RPC server-side com regra de visibilidade robusta (Fase 1)
  if (!isAdmin) {
    const { data, error } = await supabase.rpc("get_visible_conversations" as any, {
      _tenant_id: tenantId,
      _page: page,
      _page_size: pageSize,
      _status_filter: filters.statusFilter && filters.statusFilter !== "all" ? filters.statusFilter : null,
      _instance_filter: filters.instanceFilter && filters.instanceFilter !== "all" ? filters.instanceFilter : null,
      _operator_filter: filters.operatorFilter && filters.operatorFilter !== "all" ? filters.operatorFilter : null,
      _unread_only: !!filters.unreadOnly,
      _handler_filter: null,
      _search: filters.search && filters.search.trim() ? filters.search.trim() : null,
      _disposition_filter: filters.dispositionFilter && filters.dispositionFilter !== "all" ? filters.dispositionFilter : null,
    });
    if (error) {
      console.error("[conversationService] get_visible_conversations RPC error:", error);
      throw error;
    }

    const rows = (data || []) as any[];
    const total = rows.length > 0 ? Number(rows[0].total_count) || 0 : 0;
    const mapped = rows.map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      instance_id: row.instance_id,
      remote_phone: row.remote_phone,
      remote_name: row.remote_name,
      remote_avatar_url: row.remote_avatar_url ?? null,
      remote_avatar_fetched_at: row.remote_avatar_fetched_at ?? null,
      status: row.status,
      assigned_to: row.assigned_to,
      last_message_at: row.last_message_at,
      unread_count: row.unread_count,
      client_id: row.client_id,
      client_name: row.client_name ?? undefined,
      last_message_content: row.last_message_content ?? undefined,
      last_message_type: row.last_message_type ?? undefined,
      last_message_direction: row.last_message_direction ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ...(row.sla_deadline_at !== undefined ? { sla_deadline_at: row.sla_deadline_at } : {}),
    })) as Conversation[];

    return { data: mapped, count: total };
  }

  // Admins: query direta (mantém comportamento atual)
  let query = supabase
    .from("conversations" as any)
    .select("*, clients(nome_completo)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false });

  if (filters.statusFilter && filters.statusFilter !== "all") {
    query = query.eq("status", filters.statusFilter);
  }
  if (filters.instanceFilter && filters.instanceFilter !== "all") {
    query = query.eq("instance_id", filters.instanceFilter);
  }
  if (filters.operatorFilter && filters.operatorFilter !== "all") {
    query = query.eq("assigned_to", filters.operatorFilter);
  }
  if (filters.unreadOnly) {
    query = query.gt("unread_count", 0);
  }
  if (filters.dispositionFilter && filters.dispositionFilter !== "all") {
    const { data: ids } = await supabase
      .from("conversation_disposition_assignments" as any)
      .select("conversation_id")
      .eq("disposition_type_id", filters.dispositionFilter);
    const convIds = ((ids || []) as any[]).map((r: any) => r.conversation_id);
    if (convIds.length === 0) return { data: [], count: 0 };
    query = query.in("id", convIds);
  }
  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim();
    query = query.or(`remote_name.ilike.%${s}%,remote_phone.ilike.%${s}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  const mapped = ((data || []) as any[]).map((row: any) => ({
    ...row,
    client_name: row.clients?.nome_completo ?? undefined,
    clients: undefined,
    last_message_content: row.last_message_content ?? undefined,
    last_message_type: row.last_message_type ?? undefined,
    last_message_direction: row.last_message_direction ?? undefined,
  })) as Conversation[];

  return { data: mapped, count: count || 0 };
}

export async function fetchConversationCounts(
  tenantId: string,
  isAdmin = false
): Promise<{ open: number; waiting: number; closed: number; unread: number }> {
  const counts = { open: 0, waiting: 0, closed: 0, unread: 0 };

  // Operadores: usar RPC com regra de visibilidade (mesma lógica de get_visible_conversations)
  if (!isAdmin) {
    const { data, error } = await supabase.rpc("get_visible_conversation_counts" as any, {
      _tenant_id: tenantId,
    });
    if (error) {
      console.error("[conversationService] get_visible_conversation_counts RPC error:", error);
      throw error;
    }
    const row = (data as any[])?.[0];
    if (row) {
      counts.open = Number(row.open_count) || 0;
      counts.waiting = Number(row.waiting_count) || 0;
      counts.closed = Number(row.closed_count) || 0;
      counts.unread = Number(row.unread_count) || 0;
    }
    return counts;
  }

  // Admin: query direta (mantém comportamento atual)
  const [openRes, waitingRes, closedRes, unreadRes] = await Promise.all([
    supabase.from("conversations" as any).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "open"),
    supabase.from("conversations" as any).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "waiting"),
    supabase.from("conversations" as any).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "closed"),
    supabase.from("conversations" as any).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gt("unread_count", 0),
  ]);

  counts.open = openRes.count || 0;
  counts.waiting = waitingRes.count || 0;
  counts.closed = closedRes.count || 0;
  counts.unread = unreadRes.count || 0;

  return counts;
}

export async function fetchMessages(
  conversationId: string,
  page = 1,
  pageSize = 200
): Promise<{ data: ChatMessage[]; hasMore: boolean }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from("chat_messages" as any)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const messages = ((data || []) as unknown as ChatMessage[]).reverse();
  return { data: messages, hasMore: (data || []).length === pageSize };
}

export async function fetchMessagesBefore(
  conversationId: string,
  beforeCreatedAt: string,
  pageSize = 100
): Promise<{ data: ChatMessage[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from("chat_messages" as any)
    .select("*")
    .eq("conversation_id", conversationId)
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(pageSize);
  if (error) throw error;
  const messages = ((data || []) as unknown as ChatMessage[]).reverse();
  return { data: messages, hasMore: (data || []).length === pageSize };
}

export async function sendTextMessage(
  conversationId: string,
  tenantId: string,
  content: string,
  _instanceName: string,
  replyToMessageId?: string | null
): Promise<ChatMessage> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/send-chat-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId,
      content,
      replyToMessageId: replyToMessageId || undefined,
    }),
  });

  const result = await resp.json();
  if (!resp.ok) throw new Error(result?.error || "Erro ao enviar mensagem");

  return {
    id: result.message_id || crypto.randomUUID(),
    conversation_id: conversationId,
    tenant_id: tenantId,
    direction: "outbound",
    message_type: "text",
    content,
    media_url: null,
    media_mime_type: null,
    status: "sent",
    external_id: result.provider_message_id || null,
    is_internal: false,
    reply_to_message_id: replyToMessageId || null,
    created_at: new Date().toISOString(),
  } as ChatMessage;
}

export async function sendMediaMessage(
  conversationId: string,
  tenantId: string,
  mediaUrl: string,
  mediaType: "image" | "video" | "audio" | "document",
  mediaMimeType: string,
  fileName: string,
): Promise<ChatMessage> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/send-chat-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId,
      content: fileName,
      mediaUrl,
      mediaType,
      mediaMimeType,
      fileName,
    }),
  });

  const result = await resp.json();
  if (!resp.ok) throw new Error(result?.error || "Erro ao enviar mídia");

  return {
    id: result.message_id || crypto.randomUUID(),
    conversation_id: conversationId,
    tenant_id: tenantId,
    direction: "outbound",
    message_type: mediaType,
    content: fileName,
    media_url: mediaUrl,
    media_mime_type: mediaMimeType,
    status: "sent",
    external_id: result.provider_message_id || null,
    is_internal: false,
    reply_to_message_id: null,
    created_at: new Date().toISOString(),
  } as ChatMessage;
}

export async function updateConversationStatus(id: string, status: string) {
  const { error } = await supabase
    .from("conversations" as any)
    .update({ status } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function markConversationRead(id: string) {
  const { error } = await supabase
    .from("conversations" as any)
    .update({ unread_count: 0 } as any)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error: msgError } = await supabase
    .from("chat_messages" as any)
    .delete()
    .eq("conversation_id", id);
  if (msgError) throw msgError;

  await supabase
    .from("conversation_tag_assignments" as any)
    .delete()
    .eq("conversation_id", id);

  const { error } = await supabase
    .from("conversations" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function linkClientToConversation(conversationId: string, clientId: string | null) {
  const { error } = await supabase
    .from("conversations" as any)
    .update({ client_id: clientId } as any)
    .eq("id", conversationId);
  if (error) throw error;
}

export async function transferConversation(
  conversationId: string,
  toUserId: string,
  reason?: string
) {
  const { data, error } = await supabase.functions.invoke("transfer-conversation", {
    body: { conversationId, toUserId, reason: reason || null },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface ConversationTransfer {
  id: string;
  conversation_id: string;
  from_user_id: string | null;
  to_user_id: string;
  from_user_name?: string | null;
  to_user_name?: string | null;
  reason: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchConversationTransfers(
  conversationId: string
): Promise<ConversationTransfer[]> {
  const { data, error } = await supabase
    .from("conversation_transfers" as any)
    .select("id, conversation_id, from_user_id, to_user_id, reason, is_active, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data || []) as any[];
  if (rows.length === 0) return [];

  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id]).filter(Boolean))
  );
  const { data: profs } = await supabase
    .from("profiles" as any)
    .select("id, full_name")
    .in("id", ids);
  const map = new Map<string, string>();
  (profs || []).forEach((p: any) => map.set(p.id, p.full_name));
  return rows.map((r) => ({
    ...r,
    from_user_name: r.from_user_id ? map.get(r.from_user_id) || null : null,
    to_user_name: map.get(r.to_user_id) || null,
  }));
}

