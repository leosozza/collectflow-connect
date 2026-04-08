import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Conversation,
  ChatMessage,
  QuickReply,
  ConversationFilters,
  fetchConversations,
  fetchConversationCounts,
  fetchMessages,
  fetchQuickReplies,
  sendTextMessage,
  sendMediaMessage,
  sendInternalNote,
  updateConversationStatus,
  markConversationRead,
  deleteConversation,
} from "@/services/conversationService";
import { fetchWhatsAppInstances, WhatsAppInstance } from "@/services/whatsappInstanceService";
import ConversationList from "./ConversationList";
import ChatPanel from "./ChatPanel";
import ContactSidebar from "./ContactSidebar";

const PAGE_SIZE = 30;

const WhatsAppChatLayout = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const { canManageContactCenterAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = tenant?.id || profile?.tenant_id;
  const phoneParamProcessed = useRef(false);

  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [dispositionAssignments, setDispositionAssignments] = useState<{ conversation_id: string; disposition_type_id: string }[]>([]);
  const [dispositionTypes, setDispositionTypes] = useState<{ id: string; label: string; color: string; key: string }[]>([]);

  // Filters state — lifted to parent so we can pass to useInfiniteQuery
  const [filters, setFilters] = useState<ConversationFilters>({});

  const knownWaitingRef = useRef<Set<string>>(new Set());

  // Load instances + quick replies + operators + disposition types
  useEffect(() => {
    if (!tenantId) return;
    fetchWhatsAppInstances(tenantId).then(setInstances).catch(console.error);
    fetchQuickReplies(tenantId).then(setQuickReplies).catch(console.error);

    supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        if (data) {
          setOperators(data.map((p: any) => ({ id: p.user_id, name: p.full_name || "" })));
        }
      });

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

  // Server-side paginated conversations with useInfiniteQuery
  const {
    data: convPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchConversations,
  } = useInfiniteQuery({
    queryKey: ["conversations", tenantId, filters],
    queryFn: async ({ pageParam = 1 }) => {
      if (!tenantId) return { data: [], count: 0 };
      return fetchConversations(tenantId, pageParam, PAGE_SIZE, filters);
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, p) => sum + p.data.length, 0);
      if (totalLoaded < lastPage.count) return allPages.length + 1;
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!tenantId,
  });

  // Flatten pages into single conversations array
  const conversations = convPages?.pages.flatMap((p) => p.data) || [];

  // Status counts from server (separate lightweight query)
  const { data: statusCounts } = useQuery({
    queryKey: ["conversation-counts", tenantId],
    queryFn: () => fetchConversationCounts(tenantId!),
    enabled: !!tenantId,
    refetchInterval: 30000, // refresh every 30s
  });

  // Load disposition assignments for visible conversations
  useEffect(() => {
    const convIds = conversations.map((c) => c.id);
    if (convIds.length === 0) return;
    supabase
      .from("conversation_disposition_assignments" as any)
      .select("conversation_id, disposition_type_id")
      .in("conversation_id", convIds)
      .then(({ data }) => {
        if (data) setDispositionAssignments(data as any);
      });
  }, [conversations.length]);

  // Initialize known waiting set
  useEffect(() => {
    if (knownWaitingRef.current.size === 0 && conversations.length > 0) {
      for (const c of conversations) {
        if (c.status === "waiting") knownWaitingRef.current.add(c.id);
      }
    }
  }, [conversations]);

  // Auto-select or create conversation from ?phone= param
  useEffect(() => {
    if (phoneParamProcessed.current) return;
    const phoneParam = searchParams.get("phone");
    if (!phoneParam || !tenantId || conversations.length === 0 && !instances.length) return;

    phoneParamProcessed.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("phone");
      return next;
    }, { replace: true });

    const normalizedParam = phoneParam.replace(/\D/g, "");
    const suffix = normalizedParam.slice(-8);

    const existing = conversations.find((c) => {
      const remoteSuffix = (c.remote_phone || "").replace(/\D/g, "").slice(-8);
      return remoteSuffix === suffix;
    });

    if (existing) {
      setSelectedConv(existing);
      return;
    }

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
          setSelectedConv(newConv);
          refetchConversations();
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
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const conv = payload.new as any;
            if (conv.status === "waiting" && !knownWaitingRef.current.has(conv.id)) {
              knownWaitingRef.current.add(conv.id);
              supabase
                .from("notifications")
                .insert({
                  tenant_id: tenantId,
                  user_id: profile?.user_id || profile?.id,
                  title: "Conversa aguardando atendimento",
                  message: `${conv.remote_name || conv.remote_phone || "Cliente"} está aguardando resposta no WhatsApp.`,
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

          // Invalidate queries for fresh data
          queryClient.invalidateQueries({ queryKey: ["conversations", tenantId] });
          queryClient.invalidateQueries({ queryKey: ["conversation-counts", tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
    };
  }, [tenantId, profile, queryClient]);

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
    setSending(true);
    try {
      const filePath = `${tenantId}/${selectedConv.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(filePath);
      const mediaUrl = urlData.publicUrl;

      let mediaType: "image" | "video" | "audio" | "document" = "document";
      if (file.type.startsWith("image/")) mediaType = "image";
      else if (file.type.startsWith("video/")) mediaType = "video";
      else if (file.type.startsWith("audio/")) mediaType = "audio";

      await sendMediaMessage(selectedConv.id, tenantId, mediaUrl, mediaType, file.type, file.name);

      if (selectedConv.status === "waiting") {
        setSelectedConv({ ...selectedConv, status: "open" as any });
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
      refetchConversations();
      queryClient.invalidateQueries({ queryKey: ["conversation-counts", tenantId] });
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
      refetchConversations();
      queryClient.invalidateQueries({ queryKey: ["conversation-counts", tenantId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir conversa");
    }
  };

  const selectedInstance = instances.find((i) => i.id === selectedConv?.instance_id);
  const selectedInstanceName = selectedInstance?.name;
  const isOfficialApi = selectedInstance?.provider_category === "official_meta";

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[360px] max-w-[360px] shrink-0 overflow-hidden flex flex-col border-r border-border">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConv?.id || null}
            onSelect={handleSelectConv}
            onStatusChange={handleStatusChangeFromList}
            onDelete={handleDeleteConversation}
            instances={instances.map((i) => ({ id: i.id, name: i.name, provider_category: i.provider_category }))}
            operators={operators}
            isAdmin={canManageContactCenterAdmin}
            dispositionAssignments={dispositionAssignments}
            dispositionTypes={dispositionTypes}
            statusCounts={statusCounts || { open: 0, waiting: 0, closed: 0, unread: 0 }}
            onFiltersChange={setFilters}
            onLoadMore={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
            hasMore={!!hasNextPage}
            isLoadingMore={isFetchingNextPage}
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
          isOfficialApi={isOfficialApi}
          operatorName={profile?.full_name}
          dispositionAssignments={dispositionAssignments}
          dispositionTypes={dispositionTypes}
        />
        {sidebarOpen && (
          <ContactSidebar
            conversation={selectedConv}
            messages={messages}
            onClientLinked={() => refetchConversations()}
          />
        )}
      </div>
    </div>
  );
};

export default WhatsAppChatLayout;
