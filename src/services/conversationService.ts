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

export async function fetchConversations(tenantId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations" as any)
    .select("*, clients(nome_completo)")
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false });
  if (error) throw error;

  return ((data || []) as any[]).map((row: any) => ({
    ...row,
    client_name: row.clients?.nome_completo ?? undefined,
    clients: undefined,
  })) as Conversation[];
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages" as any)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as ChatMessage[];
}

export async function sendTextMessage(
  conversationId: string,
  tenantId: string,
  content: string,
  instanceName: string
): Promise<ChatMessage> {
  // Get conversation phone
  const { data: conv } = await supabase
    .from("conversations" as any)
    .select("remote_phone")
    .eq("id", conversationId)
    .single();

  if (!conv) throw new Error("Conversa não encontrada");
  const phone = (conv as any).remote_phone;

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
  const { data: msg, error } = await supabase
    .from("chat_messages" as any)
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: "outbound",
      message_type: "text",
      content,
      status: "sent",
      external_id: result?.key?.id || null,
    } as any)
    .select()
    .single();

  if (error) throw error;

  // Update conversation last_message_at
  await supabase
    .from("conversations" as any)
    .update({ last_message_at: new Date().toISOString() } as any)
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

export async function linkClientToConversation(conversationId: string, clientId: string | null) {
  const { error } = await supabase
    .from("conversations" as any)
    .update({ client_id: clientId } as any)
    .eq("id", conversationId);
  if (error) throw error;
}
