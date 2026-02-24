import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Conversation,
  ChatMessage,
  QuickReply,
  fetchConversations,
  fetchMessages,
  fetchQuickReplies,
  sendTextMessage,
  sendInternalNote,
  updateConversationStatus,
  markConversationRead,
} from "@/services/conversationService";
import { fetchWhatsAppInstances, WhatsAppInstance } from "@/services/whatsappInstanceService";
import ConversationList from "./ConversationList";
import ChatPanel from "./ChatPanel";
import ContactSidebar from "./ContactSidebar";
import GlobalSearch from "./GlobalSearch";

interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

interface TagAssignment {
  conversation_id: string;
  tag_id: string;
}

const WhatsAppChatLayout = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id || profile?.tenant_id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tags, setTags] = useState<ConversationTag[]>([]);
  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);

  // Track known waiting conversation IDs to avoid duplicate notifications
  const knownWaitingRef = useRef<Set<string>>(new Set());

  // Load instances + quick replies + tags
  useEffect(() => {
    if (!tenantId) return;
    fetchWhatsAppInstances(tenantId).then(setInstances).catch(console.error);
    fetchQuickReplies(tenantId).then(setQuickReplies).catch(console.error);

    // Load tags
    supabase
      .from("conversation_tags")
      .select("id, name, color")
      .eq("tenant_id", tenantId)
      .then(({ data }) => setTags((data as ConversationTag[]) || []));

    // Load tag assignments
    supabase
      .from("conversation_tag_assignments")
      .select("conversation_id, tag_id")
      .then(({ data }) => setTagAssignments((data as TagAssignment[]) || []));
  }, [tenantId]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await fetchConversations(tenantId);
      setConversations(data);

      // Initialize known waiting set on first load
      if (knownWaitingRef.current.size === 0) {
        for (const c of data) {
          if (c.status === "waiting") knownWaitingRef.current.add(c.id);
        }
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
    }
  }, [tenantId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when selecting conversation
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedConv.id).then(setMessages).catch(console.error);
    markConversationRead(selectedConv.id).catch(console.error);
  }, [selectedConv?.id]);

  // Load client info for selected conversation
  const [clientInfo, setClientInfo] = useState<any>(null);
  useEffect(() => {
    if (!selectedConv?.client_id) {
      setClientInfo(null);
      return;
    }
    supabase
      .from("clients")
      .select("nome_completo, valor_parcela, total_parcelas, numero_parcela, credor, cpf, data_vencimento")
      .eq("id", selectedConv.client_id)
      .single()
      .then(({ data }) => setClientInfo(data));
  }, [selectedConv?.client_id]);

  // Realtime subscriptions
  useEffect(() => {
    if (!tenantId) return;

    const convChannel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          // Check for new "waiting" conversations to send notification
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const conv = payload.new as any;
            if (conv.status === "waiting" && !knownWaitingRef.current.has(conv.id)) {
              knownWaitingRef.current.add(conv.id);
              // Create notification for the operator
              const displayName = conv.remote_name || conv.remote_phone || "Cliente";
              supabase
                .from("notifications")
                .insert({
                  tenant_id: tenantId,
                  user_id: profile?.user_id || profile?.id,
                  title: "Conversa aguardando atendimento",
                  message: `${displayName} está aguardando resposta no WhatsApp.`,
                  type: "warning",
                  reference_type: "conversation",
                  reference_id: conv.id,
                } as any)
                .then(({ error }) => {
                  if (error) console.error("Error creating waiting notification:", error);
                });
            } else if (conv.status !== "waiting") {
              knownWaitingRef.current.delete(conv.id);
            }
          }
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, [tenantId, loadConversations, profile]);

  useEffect(() => {
    if (!selectedConv) return;

    const msgChannel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          const newMsg = payload.new as unknown as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          if (newMsg.direction === "inbound") {
            markConversationRead(selectedConv.id).catch(console.error);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          const updated = payload.new as unknown as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedConv?.id]);

  const handleSelectConv = (conv: Conversation) => {
    setSelectedConv(conv);
  };

  const getInstanceForConv = () => {
    if (!selectedConv) return null;
    return instances.find((i) => i.id === selectedConv.instance_id) || null;
  };

  const handleSend = async (text: string) => {
    if (!selectedConv || !tenantId) return;
    const instance = getInstanceForConv();
    if (!instance) {
      toast.error("Instância não encontrada");
      return;
    }
    setSending(true);
    try {
      await sendTextMessage(selectedConv.id, tenantId, text, instance.instance_name);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleSendInternalNote = async (text: string) => {
    if (!selectedConv || !tenantId) return;
    setSending(true);
    try {
      await sendInternalNote(selectedConv.id, tenantId, text);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar nota");
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (file: File) => {
    if (!selectedConv || !tenantId) return;
    const instance = getInstanceForConv();
    if (!instance) {
      toast.error("Instância não encontrada");
      return;
    }
    setSending(true);
    try {
      const filePath = `${tenantId}/${selectedConv.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;

      let mediaType = "document";
      if (file.type.startsWith("image/")) mediaType = "image";
      else if (file.type.startsWith("video/")) mediaType = "video";
      else if (file.type.startsWith("audio/")) mediaType = "audio";

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const conv = selectedConv;
      const resp = await fetch(`${supabaseUrl}/functions/v1/evolution-proxy?action=sendMessage`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instance.instance_name,
          phone: conv.remote_phone,
          mediaUrl,
          mediaType,
          message: file.name,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result?.error || "Erro ao enviar mídia");

      await supabase.from("chat_messages" as any).insert({
        conversation_id: conv.id,
        tenant_id: tenantId,
        direction: "outbound",
        message_type: mediaType,
        content: file.name,
        media_url: mediaUrl,
        media_mime_type: file.type,
        status: "sent",
        external_id: result?.key?.id || null,
      } as any);

      await supabase
        .from("conversations" as any)
        .update({ last_message_at: new Date().toISOString() } as any)
        .eq("id", conv.id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mídia");
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (blob: Blob) => {
    const file = new File([blob], `audio_${Date.now()}.webm`, { type: "audio/webm;codecs=opus" });
    await handleSendMedia(file);
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedConv) return;
    try {
      await updateConversationStatus(selectedConv.id, status);
      setSelectedConv({ ...selectedConv, status: status as any });
      loadConversations();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleGlobalSearchNavigate = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) setSelectedConv(conv);
  };

  const selectedInstanceName = instances.find((i) => i.id === selectedConv?.instance_id)?.name;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[360px] shrink-0 overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConv?.id || null}
            onSelect={handleSelectConv}
            instances={instances.map((i) => ({ id: i.id, name: i.name }))}
            tags={tags}
            tagAssignments={tagAssignments}
          />
        </div>
        <ChatPanel
          conversation={selectedConv}
          messages={messages}
          onSend={handleSend}
          onSendMedia={handleSendMedia}
          onSendAudio={handleSendAudio}
          onSendInternalNote={handleSendInternalNote}
          sending={sending}
          onStatusChange={handleStatusChange}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          instanceName={selectedInstanceName}
          clientInfo={clientInfo}
          quickReplies={quickReplies}
          slaDeadline={(selectedConv as any)?.sla_deadline_at}
          operatorName={profile?.full_name}
        />
        {sidebarOpen && (
          <ContactSidebar
            conversation={selectedConv}
            messages={messages}
            onClientLinked={loadConversations}
          />
        )}
      </div>
    </div>
  );
};

export default WhatsAppChatLayout;
