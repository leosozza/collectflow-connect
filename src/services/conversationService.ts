import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  id: string;
  tenant_id: string;
  instance_id: string;
  remote_phone: string;
  remote_name: string;
  status: "open" | "waiting" | "closed";
  assigned_to: string | null;
  last_message_at: string;
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
  pageSize = 50,
  statusFilter?: string
): Promise<{ data: Conversation[]; count: number }> {
  let query = supabase
    .from("conversations" as any)
    .select("*, clients(nome_completo)", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  // Batch-fetch last message for each conversation
  const convIds = ((data || []) as any[]).map((r: any) => r.id);
  let lastMsgMap: Record<string, { content: string | null; message_type: string; direction: string }> = {};
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from("chat_messages" as any)
      .select("conversation_id, content, message_type, direction, created_at")
      .in("conversation_id", convIds)
      .eq("is_internal", false)
      .order("created_at", { ascending: false });
    if (msgs) {
      for (const m of msgs as any[]) {
        if (!lastMsgMap[m.conversation_id]) {
          lastMsgMap[m.conversation_id] = { content: m.content, message_type: m.message_type, direction: m.direction };
        }
      }
    }
  }

  const mapped = ((data || []) as any[]).map((row: any) => ({
    ...row,
    client_name: row.clients?.nome_completo ?? undefined,
    clients: undefined,
    last_message_content: lastMsgMap[row.id]?.content ?? undefined,
    last_message_type: lastMsgMap[row.id]?.message_type ?? undefined,
    last_message_direction: lastMsgMap[row.id]?.direction ?? undefined,
  })) as Conversation[];

  return { data: mapped, count: count || 0 };
}

export async function fetchMessages(
  conversationId: string,
  page = 1,
  pageSize = 100
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

export async function sendTextMessage(
  conversationId: string,
  tenantId: string,
  content: string,
  instanceName: string,
  replyToMessageId?: string | null
): Promise<ChatMessage> {
  // Get conversation phone + status
  const { data: conv } = await supabase
    .from("conversations" as any)
    .select("remote_phone, status")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .single();

  if (!conv) throw new Error("Conversa não encontrada");
  const phone = (conv as any).remote_phone;
  const convStatus = (conv as any).status;

  // Send via evolution-proxy
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/evolution-proxy?action=sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ instanceName, phone, message: content }),
  });

  const result = await resp.json();
  if (!resp.ok) throw new Error(result?.error || "Erro ao enviar mensagem");

  // Insert local message
  const insertData: any = {
    conversation_id: conversationId,
    tenant_id: tenantId,
    direction: "outbound",
    message_type: "text",
    content,
    status: "sent",
    external_id: result?.key?.id || null,
  };
  if (replyToMessageId) {
    insertData.reply_to_message_id = replyToMessageId;
  }

  const { data: msg, error } = await supabase
    .from("chat_messages" as any)
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;

  // Update conversation last_message_at + auto-accept if waiting
  const updatePayload: any = { last_message_at: new Date().toISOString() };
  if (convStatus === "waiting") {
    updatePayload.status = "open";
  }

  await supabase
    .from("conversations" as any)
    .update(updatePayload)
    .eq("id", conversationId);

  return msg as unknown as ChatMessage;
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
  // Delete messages first (FK constraint)
  const { error: msgError } = await supabase
    .from("chat_messages" as any)
    .delete()
    .eq("conversation_id", id);
  if (msgError) throw msgError;

  // Delete tag assignments
  await supabase
    .from("conversation_tag_assignments" as any)
    .delete()
    .eq("conversation_id", id);

  // Delete conversation
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
