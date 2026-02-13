import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Conversation,
  ChatMessage,
  fetchConversations,
  fetchMessages,
  sendTextMessage,
  updateConversationStatus,
  markConversationRead,
} from "@/services/conversationService";
import { fetchWhatsAppInstances, WhatsAppInstance } from "@/services/whatsappInstanceService";
import ConversationList from "./ConversationList";
import ChatPanel from "./ChatPanel";
import ContactSidebar from "./ContactSidebar";

const WhatsAppChatLayout = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id || profile?.tenant_id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load instances
  useEffect(() => {
    if (!tenantId) return;
    fetchWhatsAppInstances(tenantId).then(setInstances).catch(console.error);
  }, [tenantId]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const data = await fetchConversations(tenantId);
      setConversations(data);
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

  // Realtime subscriptions
  useEffect(() => {
    if (!tenantId) return;

    const convChannel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `tenant_id=eq.${tenantId}` },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, [tenantId, loadConversations]);

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
          // Mark read if inbound
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

  const handleSend = async (text: string) => {
    if (!selectedConv || !tenantId) return;
    const instance = instances.find((i) => i.id === selectedConv.instance_id);
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

  const selectedInstanceName = instances.find((i) => i.id === selectedConv?.instance_id)?.name;

  return (
    <div className="flex h-[calc(100vh-4rem)] rounded-lg overflow-hidden border border-border bg-card">
      <div className="w-[300px] shrink-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConv?.id || null}
          onSelect={handleSelectConv}
          instances={instances.map((i) => ({ id: i.id, name: i.name }))}
        />
      </div>
      <ChatPanel
        conversation={selectedConv}
        messages={messages}
        onSend={handleSend}
        sending={sending}
        onStatusChange={handleStatusChange}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        instanceName={selectedInstanceName}
      />
      {sidebarOpen && (
        <ContactSidebar
          conversation={selectedConv}
          onClientLinked={loadConversations}
        />
      )}
    </div>
  );
};

export default WhatsAppChatLayout;
