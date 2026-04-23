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
  fetchMessagesBefore,
  fetchQuickReplies,
  sendTextMessage,
  sendMediaMessage,
  sendInternalNote,
  updateConversationStatus,
  markConversationRead,
  markConversationUnread,
  deleteConversation,
} from "@/services/conversationService";
import { fetchWhatsAppInstances, WhatsAppInstance } from "@/services/whatsappInstanceService";
import ConversationList from "./ConversationList";
import ChatPanel from "./ChatPanel";
import ContactSidebar from "./ContactSidebar";
import { useConversationAvatars } from "@/hooks/useConversationAvatars";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 30;

const WhatsAppChatLayout = () => {
  const { profile } = useAuth();
  const { tenant, tenantUser } = useTenant();
  const { canManageContactCenterAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = tenant?.id || profile?.tenant_id;
  const isAdmin = tenantUser?.role === "admin" || tenantUser?.role === "super_admin";
  const phoneParamProcessed = useRef(false);

  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [dispositionAssignments, setDispositionAssignments] = useState<{ conversation_id: string; disposition_type_id: string }[]>([]);
  const [dispositionTypes, setDispositionTypes] = useState<{ id: string; label: string; color: string; key: string }[]>([]);

  // Filters state — lifted to parent so we can pass to useInfiniteQuery
  const [filters, setFilters] = useState<ConversationFilters>({});

  // Conflict dialog: existing conversation in another instance
  const [conflictState, setConflictState] = useState<{
    existingConv: Conversation;
    targetInstanceId: string;
    phone: string;
  } | null>(null);

  const knownWaitingRef = useRef<Set<string>>(new Set());

  // Load instances + quick replies + operators + disposition types
  useEffect(() => {
    if (!tenantId) return;
    const isAdminRole = profile?.role === "admin" || tenantUser?.role === "super_admin";

    (async () => {
      try {
        const all = await fetchWhatsAppInstances(tenantId);
        if (isAdminRole) {
          setInstances(all);
        } else {
          // Restrict to instances assigned to this operator via operator_instances
          const profileId = profile?.id;
          if (!profileId) {
            setInstances([]);
            return;
          }
          const { data: assignments } = await supabase
            .from("operator_instances" as any)
            .select("instance_id")
            .eq("profile_id", profileId)
            .eq("tenant_id", tenantId);
          const allowedIds = new Set((assignments || []).map((a: any) => a.instance_id));
          setInstances(all.filter((i) => allowedIds.has(i.id)));
        }
      } catch (err) {
        console.error(err);
      }
    })();

    fetchQuickReplies(tenantId).then(setQuickReplies).catch(console.error);

    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        if (data) {
          setOperators(data.map((p: any) => ({ id: p.id, name: p.full_name || "" })));
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
    queryKey: ["conversations", tenantId, filters, isAdmin],
    queryFn: async ({ pageParam = 1 }) => {
      if (!tenantId) return { data: [], count: 0 };
      try {
        return await fetchConversations(tenantId, pageParam, PAGE_SIZE, filters, isAdmin);
      } catch (err: any) {
        console.error("[WhatsAppChatLayout] fetchConversations failed:", err);
        toast.error(`Falha ao carregar conversas: ${err?.message || err}`);
        throw err;
      }
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

  // Lazy-fetch profile pictures for visible conversations (Evolution/Wuzapi only)
  useConversationAvatars(conversations, useCallback((id: string, url: string | null) => {
    if (!url) return;
    queryClient.setQueryData(["conversations", tenantId, filters, isAdmin], (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((p: any) => ({
          ...p,
          data: p.data.map((c: Conversation) =>
            c.id === id ? { ...c, remote_avatar_url: url, remote_avatar_fetched_at: new Date().toISOString() } : c
          ),
        })),
      };
    });
    // Also update selected conversation if it matches
    setSelectedConv((prev) => (prev && prev.id === id ? { ...prev, remote_avatar_url: url } : prev));
  }, [queryClient, tenantId, filters, isAdmin]));

  // Status counts from server (separate lightweight query)
  const { data: statusCounts } = useQuery({
    queryKey: ["conversation-counts", tenantId, isAdmin],
    queryFn: async () => {
      try {
        return await fetchConversationCounts(tenantId!, isAdmin);
      } catch (err: any) {
        console.error("[WhatsAppChatLayout] fetchConversationCounts failed:", err);
        toast.error(`Falha ao carregar contadores: ${err?.message || err}`);
        throw err;
      }
    },
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

  // Helper: create a brand new conversation on a target instance
  const createConversationOnInstance = useCallback(
    async (phone: string, targetInstanceId: string) => {
      try {
        const { data: resolved } = await supabase.rpc("resolve_client_by_phone" as any, {
          _tenant_id: tenantId,
          _phone: phone,
        });
        const clientRow: any = Array.isArray(resolved) ? resolved[0] : null;

        const { data, error } = await supabase
          .from("conversations")
          .insert({
            tenant_id: tenantId,
            instance_id: targetInstanceId,
            remote_phone: phone,
            remote_name: clientRow?.nome_completo ?? "",
            client_id: clientRow?.client_id ?? null,
            channel_type: "whatsapp",
            status: "open",
            last_message_at: new Date().toISOString(),
          } as any)
          .select()
          .single();

        if (error) {
          // Conversa já existe nesta instância → buscar e selecionar
          if (error.code === "23505") {
            const { data: existing } = await supabase
              .from("conversations")
              .select("*")
              .eq("tenant_id", tenantId)
              .eq("instance_id", targetInstanceId)
              .eq("remote_phone", phone)
              .maybeSingle();
            if (existing) {
              setSelectedConv(existing as unknown as Conversation);
              refetchConversations();
              toast.info("Conversa já existente foi selecionada");
              return;
            }
          }
          throw error;
        }
        if (data) {
          const newConv = data as unknown as Conversation;
          setSelectedConv(newConv);
          refetchConversations();
        }
      } catch (err: any) {
        console.error("Error creating conversation:", err);
        toast.error(err?.message || "Erro ao criar conversa");
      }
    },
    [tenantId, refetchConversations]
  );

  // Auto-select via ?conversationId= param (highest priority)
  useEffect(() => {
    if (phoneParamProcessed.current) return;
    const conversationIdParam = searchParams.get("conversationId");
    if (!conversationIdParam || !tenantId || convPages === undefined) return;

    phoneParamProcessed.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("conversationId");
      return next;
    }, { replace: true });

    const found = conversations.find((c) => c.id === conversationIdParam);
    if (found) {
      setSelectedConv(found);
      return;
    }
    // Not in loaded pages — fetch directly
    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationIdParam)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) {
        console.error("Error fetching conversation by id:", error);
        toast.error("Não foi possível abrir a conversa");
        return;
      }
      if (data) {
        setSelectedConv(data as unknown as Conversation);
        refetchConversations();
      }
    })();
  }, [searchParams, convPages, tenantId, setSearchParams, refetchConversations]);

  // Auto-select or create conversation from ?phone= param
  useEffect(() => {
    if (phoneParamProcessed.current) return;
    const phoneParam = searchParams.get("phone");
    const instanceIdParam = searchParams.get("instanceId");
    const forceNewParam = searchParams.get("forceNew") === "1";
    // Aguarda BOTH carregarem para evitar criar duplicata enquanto a lista ainda paginava
    if (!phoneParam || !tenantId || instances.length === 0 || convPages === undefined) return;

    phoneParamProcessed.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("phone");
      next.delete("instanceId");
      next.delete("forceNew");
      return next;
    }, { replace: true });

    const normalizedParam = phoneParam.replace(/\D/g, "");
    const suffix = normalizedParam.slice(-8);

    const allowedInstanceIds = new Set(instances.map((i) => i.id));
    const matchingByPhone = conversations.filter((c) => {
      const remoteSuffix = (c.remote_phone || "").replace(/\D/g, "").slice(-8);
      return remoteSuffix === suffix && (!c.instance_id || allowedInstanceIds.has(c.instance_id));
    });

    const targetInstanceId = instanceIdParam || instances[0]?.id || null;

    // If not forcing new: prefer ANY existing match (most recent first — lista vem ordenada por last_message_at desc)
    if (!forceNewParam && matchingByPhone.length > 0) {
      const sameInstanceMatch = targetInstanceId
        ? matchingByPhone.find((c) => c.instance_id === targetInstanceId)
        : null;
      setSelectedConv(sameInstanceMatch || matchingByPhone[0]);
      return;
    }

    // forceNew + already exists in target instance → just select (não duplicar)
    if (forceNewParam && targetInstanceId) {
      const sameInstanceMatch = matchingByPhone.find((c) => c.instance_id === targetInstanceId);
      if (sameInstanceMatch) {
        setSelectedConv(sameInstanceMatch);
        return;
      }
      // forceNew + existe em outra instância permitida → conflict dialog (admin pode escolher)
      const otherInstanceMatch = matchingByPhone.find((c) => c.instance_id !== targetInstanceId);
      if (otherInstanceMatch) {
        setConflictState({
          existingConv: otherInstanceMatch,
          targetInstanceId,
          phone: normalizedParam,
        });
        return;
      }
    }

    // No match — create new on target (or fallback)
    if (!targetInstanceId) {
      toast.error("Nenhuma instância WhatsApp configurada");
      return;
    }
    createConversationOnInstance(normalizedParam, targetInstanceId);
  }, [searchParams, convPages, instances, tenantId, createConversationOnInstance, setSearchParams]);

  // Load messages when selecting conversation
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      setHasMoreOlder(false);
      return;
    }
    fetchMessages(selectedConv.id)
      .then((result) => {
        setMessages(result.data);
        setHasMoreOlder(result.hasMore);
      })
      .catch(console.error);
    // Always clear unread_count when any authorized operator opens the conversation.
    // Optimistically reset locally so the green badge disappears immediately.
    if ((selectedConv.unread_count ?? 0) > 0) {
      setSelectedConv((prev) => (prev && prev.id === selectedConv.id ? { ...prev, unread_count: 0 } : prev));
      queryClient.setQueriesData({ queryKey: ["conversations", tenantId] }, (old: any) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: (page.data || []).map((c: Conversation) =>
              c.id === selectedConv.id ? { ...c, unread_count: 0 } : c
            ),
          })),
        };
      });
    }
    markConversationRead(selectedConv.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["conversation-counts", tenantId] });
      })
      .catch(console.error);
  }, [selectedConv?.id, tenantId, queryClient]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedConv || loadingOlder || !hasMoreOlder) return;
    const oldest = messages[0]?.created_at;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const result = await fetchMessagesBefore(selectedConv.id, oldest, 100);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = result.data.filter((m) => !existingIds.has(m.id));
        return [...newOnes, ...prev];
      });
      setHasMoreOlder(result.hasMore);
    } catch (err) {
      console.error("[WhatsAppChatLayout] loadOlderMessages error:", err);
    } finally {
      setLoadingOlder(false);
    }
  }, [selectedConv, loadingOlder, hasMoreOlder, messages]);

  // Load client info for selected conversation
  const [clientInfo, setClientInfo] = useState<any>(null);
  useEffect(() => {
    if (!selectedConv) {
      setClientInfo(null);
      return;
    }

    // Auto-resolve: if conversation has no client_id but has a remote_phone, try to link it
    if (!selectedConv.client_id && selectedConv.remote_phone && tenantId) {
      (async () => {
        const { data: resolved } = await supabase.rpc("resolve_client_by_phone" as any, {
          _tenant_id: tenantId,
          _phone: selectedConv.remote_phone,
        });
        const clientRow: any = Array.isArray(resolved) ? resolved[0] : null;
        if (clientRow?.client_id) {
          await supabase
            .from("conversations")
            .update({
              client_id: clientRow.client_id,
              remote_name: clientRow.nome_completo || selectedConv.remote_name || "",
            } as any)
            .eq("id", selectedConv.id);
          setSelectedConv({
            ...selectedConv,
            client_id: clientRow.client_id,
            remote_name: clientRow.nome_completo || selectedConv.remote_name,
          } as any);
        } else {
          setClientInfo(null);
        }
      })();
      return;
    }

    if (!selectedConv.client_id) {
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
  }, [selectedConv?.client_id, selectedConv?.id, tenantId]);

  // Realtime subscriptions
  useEffect(() => {
    if (!tenantId) return;

    const convChannel = supabase
      .channel(`conversations-realtime-${tenantId}`)
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
      .channel(`messages-realtime-${selectedConv.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selectedConv.id}` },
        (payload) => {
          const newMsg = payload.new as unknown as ChatMessage;
          setMessages((prev) => {
            // Already present (real id) — skip
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Try to replace a matching optimistic message (same direction/content within recent window)
            const idx = prev.findIndex(
              (m) =>
                (m as any).__optimistic &&
                m.direction === newMsg.direction &&
                (m.content || "") === (newMsg.content || "") &&
                m.message_type === newMsg.message_type
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = newMsg;
              return next;
            }
            return [...prev, newMsg];
          });
          if (newMsg.direction === "inbound") {
            // Always mark as read when the conversation is open in the UI.
            markConversationRead(selectedConv.id)
              .then(() => queryClient.invalidateQueries({ queryKey: ["conversation-counts", tenantId] }))
              .catch(console.error);
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
  }, [selectedConv?.id, tenantId, queryClient]);

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
    // Optimistic UI: show message immediately while the edge function works.
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversation_id: selectedConv.id,
      tenant_id: tenantId,
      direction: "outbound",
      message_type: "text",
      content: text,
      status: "sending",
      created_at: new Date().toISOString(),
      actor_type: "human",
      is_internal: false,
      reply_to_message_id: replyToMessageId || null,
      __optimistic: true,
    } as any;
    setMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);
    try {
      await sendTextMessage(selectedConv.id, tenantId, text, instance.instance_name, replyToMessageId);
      // Real message will arrive via Realtime and replace the optimistic one.
    } catch (err: any) {
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? ({ ...m, status: "failed" } as ChatMessage) : m))
      );
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
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${tenantId}/${selectedConv.id}/${Date.now()}_${safeName}`;
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
    const mime = blob.type || "audio/ogg;codecs=opus";
    const extMap: Record<string, string> = {
      "audio/ogg": ".ogg",
      "audio/ogg;codecs=opus": ".ogg",
      "audio/mp4": ".m4a",
      "audio/mpeg": ".mp3",
      "audio/webm": ".webm",
      "audio/webm;codecs=opus": ".webm",
    };
    const ext = extMap[mime] || ".ogg";
    const file = new File([blob], `audio_${Date.now()}${ext}`, { type: mime });
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
  const isOfficialApi = selectedInstance?.provider_category === "official_meta" || selectedInstance?.provider_category === "official";

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
          hasMoreOlder={hasMoreOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={handleLoadOlderMessages}
        />
        {sidebarOpen && (
          <ContactSidebar
            conversation={selectedConv}
            messages={messages}
            onClientLinked={() => refetchConversations()}
          />
        )}
      </div>

      <AlertDialog
        open={!!conflictState}
        onOpenChange={(o) => { if (!o) setConflictState(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Já existe uma conversa com este número</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!conflictState) return null;
                const existingInstance = instances.find((i) => i.id === conflictState.existingConv.instance_id);
                const targetInstance = instances.find((i) => i.id === conflictState.targetInstanceId);
                const operatorName = operators.find((o) => o.id === conflictState.existingConv.assigned_to)?.name;
                return (
                  <>
                    Existe uma conversa aberta com este número na instância{" "}
                    <strong>{existingInstance?.name || "outra instância"}</strong>
                    {operatorName && <> (operador <strong>{operatorName}</strong>)</>}.
                    {" "}Deseja mesmo abrir uma nova conversa pela instância{" "}
                    <strong>{targetInstance?.name || "selecionada"}</strong>?
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (conflictState) setSelectedConv(conflictState.existingConv);
                setConflictState(null);
              }}
            >
              Abrir a existente
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!conflictState) return;
                const { phone, targetInstanceId } = conflictState;
                setConflictState(null);
                await createConversationOnInstance(phone, targetInstanceId);
              }}
            >
              Criar nova
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsAppChatLayout;
