import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
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
  deleteConversation,
} from "@/services/conversationService";
import { fetchWhatsAppInstances, WhatsAppInstance } from "@/services/whatsappInstanceService";
import ConversationList from "./ConversationList";
import ChatPanel from "./ChatPanel";
import ContactSidebar from "./ContactSidebar";
import GlobalSearch from "./GlobalSearch";

const WhatsAppChatLayout = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const { canManageContactCenterAdmin } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = tenant?.id || profile?.tenant_id;
  const phoneParamProcessed = useRef(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [dispositionAssignments, setDispositionAssignments] = useState<{ conversation_id: string; disposition_type_id: string }[]>([]);
  const [dispositionTypes, setDispositionTypes] = useState<{ id: string; label: string; color: string; key: string }[]>([]);

  // Track known waiting conversation IDs to avoid duplicate notifications
  const knownWaitingRef = useRef<Set<string>>(new Set());

  // Load instances + quick replies + operators + disposition types
  useEffect(() => {
    if (!tenantId) return;
    fetchWhatsAppInstances(tenantId).then(setInstances).catch(console.error);
    fetchQuickReplies(tenantId).then(setQuickReplies).catch(console.error);

    // Load operators for admin filter
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        if (data) {
          setOperators(data.map((p: any) => ({ id: p.user_id, name: p.full_name || "" })));
        }
      });

    // Load whatsapp disposition types
    supabase
      .from("call_disposition_types")
      .select("id, label, color, key")
      .eq("tenant_id", tenantId)
      .eq("channel", "whatsapp")
      .eq("active", true)
      .then(({ data }) => {
        if (data) setDispositionTypes(data);
      });
  }, [tenantId]);

  // Load conversations + disposition assignments
  const loadConversations = useCallback(async () => {
    if (!tenantId) return;
    try {
      const result = await fetchConversations(tenantId);
      setConversations(result.data);

      // Load disposition assignments for all conversations
      const convIds = result.data.map((c) => c.id);
      if (convIds.length > 0) {
        const { data: assignments } = await supabase
          .from("conversation_disposition_assignments" as any)
          .select("conversation_id, disposition_type_id")
          .in("conversation_id", convIds);
        if (assignments) setDispositionAssignments(assignments as any);
      }

      // Initialize known waiting set on first load
      if (knownWaitingRef.current.size === 0) {
        for (const c of result.data) {
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

  // Auto-select or create conversation from ?phone= param
  useEffect(() => {
    if (phoneParamProcessed.current) return;
    const phoneParam = searchParams.get("phone");
    if (!phoneParam || !tenantId || conversations.length === 0 && !instances.length) return;

    phoneParamProcessed.current = true;
    // Clear the param from URL
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("phone");
      return next;
    }, { replace: true });

    const normalizedParam = phoneParam.replace(/\D/g, "");
    const suffix = normalizedParam.slice(-8);

    // Try to find existing conversation
    const existing = conversations.find((c) => {
      const remoteSuffix = (c.remote_phone || "").replace(/\D/g, "").slice(-8);
      return remoteSuffix === suffix;
    });

    if (existing) {
      setSelectedConv(existing);
      return;
    }

    // Create new conversation
    const defaultInstance = instances[0];
    if (!defaultInstance) {
      toast.error("Nenhuma instância WhatsApp configurada");
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("conversations")
          .insert({
            tenant_id: tenantId,
            instance_id: defaultInstance.id,
            remote_phone: normalizedParam,
            status: "open",
            last_message_at: new Date().toISOString(),
          } as any)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          const newConv = data as unknown as Conversation;
          setConversations((prev) => [newConv, ...prev]);
          setSelectedConv(newConv);
        }
      } catch (err: any) {
        console.error("Error creating conversation:", err);
        toast.error("Erro ao criar conversa");
      }
    })();
  }, [searchParams, conversations, instances, tenantId]);

  // Load messages when selecting conversation
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedConv.id).then((result) => setMessages(result.data)).catch(console.error);
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
      .eq("tenant_id", tenantId!)
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

          // Optimized: update state incrementally instead of full reload
          if (payload.eventType === "INSERT") {
            const newConv = payload.new as any;
            // Fetch client name for the new conversation
            if (newConv.client_id) {
              supabase.from("clients").select("nome_completo").eq("id", newConv.client_id).single()
                .then(({ data }) => {
                  setConversations(prev => [{
                    ...newConv,
                    client_name: data?.nome_completo ?? undefined,
                  } as Conversation, ...prev]);
                });
            } else {
              setConversations(prev => [newConv as Conversation, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as any;
            setConversations(prev => {
              const idx = prev.findIndex(c => c.id === updated.id);
              if (idx === -1) return prev;
              const updatedConv = { ...prev[idx], ...updated };
              const newList = [...prev];
              newList[idx] = updatedConv;
              // Re-sort by last_message_at
              newList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
              return newList;
            });
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as any;
            setConversations(prev => prev.filter(c => c.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, [tenantId, profile]);

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

  const handleSend = async (text: string, replyToMessageId?: string | null) => {
    if (!selectedConv || !tenantId) return;
    const instance = getInstanceForConv();
    if (!instance) {
      toast.error("Instância não encontrada");
      return;
    }
    setSending(true);
    try {
      await sendTextMessage(selectedConv.id, tenantId, text, instance.instance_name, replyToMessageId);
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

      // Auto-accept: waiting -> open when operator sends media/audio
      const convUpdatePayload: any = { last_message_at: new Date().toISOString() };
      if (selectedConv.status === "waiting") {
        convUpdatePayload.status = "open";
      }
      await supabase
        .from("conversations" as any)
        .update(convUpdatePayload)
        .eq("id", conv.id);

      if (selectedConv.status === "waiting") {
        setSelectedConv({ ...selectedConv, status: "open" as any });
        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: "open" as any } : c));
      }
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

  const handleStatusChangeFromList = async (convId: string, status: string) => {
    try {
      await updateConversationStatus(convId, status);
      if (selectedConv?.id === convId) {
        setSelectedConv({ ...selectedConv, status: status as any });
      }
      loadConversations();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedConv) return;
    await handleStatusChangeFromList(selectedConv.id, status);
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId);
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
      }
      toast.success("Conversa excluída");
      loadConversations();
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir conversa");
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
            onStatusChange={handleStatusChangeFromList}
            onDelete={handleDeleteConversation}
            instances={instances.map((i) => ({ id: i.id, name: i.name }))}
            operators={operators}
            isAdmin={canManageContactCenterAdmin}
            dispositionAssignments={dispositionAssignments}
            dispositionTypes={dispositionTypes}
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
          dispositionAssignments={dispositionAssignments}
          dispositionTypes={dispositionTypes}
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
