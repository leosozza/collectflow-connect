import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isSameDay } from "date-fns";
import DateSeparator from "./DateSeparator";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, User, PanelRightOpen, PanelRightClose, AlertTriangle, Headphones, Loader2, Clock, UserCheck, ArrowRightLeft, Lock, CheckCircle, RotateCcw } from "lucide-react";
import TransferConversationDialog from "./TransferConversationDialog";
import CloseConversationDialog from "./CloseConversationDialog";
import MultiInstanceAlert from "./MultiInstanceAlert";
import AutoCloseIndicator from "./AutoCloseIndicator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChatMessageBubble from "./ChatMessage";
import ChatInput from "./ChatInput";
import AISuggestion from "./AISuggestion";
import WhatsAppGateBanner from "./WhatsAppGateBanner";
import { Conversation, ChatMessage } from "@/services/conversationService";
import { findOrCreateSession } from "@/services/atendimentoSessionService";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onSend: (text: string, replyToMessageId?: string | null) => void;
  onSendMedia: (file: File) => void;
  onSendAudio: (blob: Blob) => void;
  onSendInternalNote?: (text: string) => void;
  sending: boolean;
  onStatusChange: (status: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  instanceName?: string;
  clientInfo?: any;
  quickReplies?: any[];
  slaDeadline?: string | null;
  isOfficialApi?: boolean;
  operatorName?: string;
  dispositionAssignments?: { conversation_id: string; disposition_type_id: string }[];
  dispositionTypes?: { id: string; label: string; color: string; key: string }[];
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void | Promise<void>;
}

const ChatPanel = ({
  conversation,
  messages,
  onSend,
  onSendMedia,
  onSendAudio,
  onSendInternalNote,
  sending,
  onStatusChange,
  sidebarOpen,
  onToggleSidebar,
  instanceName,
  clientInfo,
  quickReplies,
  slaDeadline,
  isOfficialApi,
  operatorName,
  dispositionAssignments = [],
  dispositionTypes = [],
  hasMoreOlder = false,
  loadingOlder = false,
  onLoadOlder,
}: ChatPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [openingAtendimento, setOpeningAtendimento] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  // Build a flat list interleaving date separators between messages of different days
  const messageItems = useMemo(() => {
    const items: Array<
      | { type: "separator"; key: string; date: Date }
      | { type: "message"; key: string; message: ChatMessage }
    > = [];
    let prevDate: Date | null = null;
    for (const msg of messages) {
      const curr = new Date(msg.created_at);
      if (!prevDate || !isSameDay(prevDate, curr)) {
        items.push({ type: "separator", key: `sep-${curr.toDateString()}`, date: curr });
      }
      items.push({ type: "message", key: msg.id, message: msg });
      prevDate = curr;
    }
    return items;
  }, [messages]);
  const [slaRemaining, setSlaRemaining] = useState<string | null>(null);
  const [slaRemainingMs, setSlaRemainingMs] = useState<number>(0);

  // Track previous scroll metrics for infinite scroll up (preserve position)
  const prevScrollRef = useRef<{ height: number; top: number } | null>(null);
  const isFetchingOlderRef = useRef(false);
  const lastConvIdRef = useRef<string | null>(null);
  const prevMsgCountRef = useRef(0);

  // Auto-scroll to bottom on new messages (only when not loading older)
  useEffect(() => {
    const convChanged = lastConvIdRef.current !== (conversation?.id || null);
    if (convChanged) {
      lastConvIdRef.current = conversation?.id || null;
      prevMsgCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      return;
    }
    // Only auto-scroll when messages were appended at the bottom (not prepended)
    const grew = messages.length > prevMsgCountRef.current;
    const wasOlderLoad = !!prevScrollRef.current;
    prevMsgCountRef.current = messages.length;
    if (grew && !wasOlderLoad) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, conversation?.id]);

  // Preserve scroll position after older messages are prepended
  useLayoutEffect(() => {
    if (!prevScrollRef.current) return;
    const root = scrollContainerRef.current as unknown as HTMLElement | null;
    const node = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!node) {
      prevScrollRef.current = null;
      return;
    }
    const diff = node.scrollHeight - prevScrollRef.current.height;
    node.scrollTop = prevScrollRef.current.top + diff;
    prevScrollRef.current = null;
  }, [messages.length]);

  // Infinite scroll up: detect when user scrolls near top
  useEffect(() => {
    const root = scrollContainerRef.current as unknown as HTMLElement | null;
    const node = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!node || !onLoadOlder) return;

    const onScroll = async () => {
      if (node.scrollTop < 80 && hasMoreOlder && !loadingOlder && !isFetchingOlderRef.current) {
        isFetchingOlderRef.current = true;
        prevScrollRef.current = { height: node.scrollHeight, top: node.scrollTop };
        try {
          await onLoadOlder();
        } finally {
          isFetchingOlderRef.current = false;
        }
      }
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, [hasMoreOlder, loadingOlder, onLoadOlder, conversation?.id]);

  // SLA countdown timer
  useEffect(() => {
    if (!slaDeadline) {
      setSlaRemaining(null);
      return;
    }

    const update = () => {
      const deadlineMs = new Date(slaDeadline).getTime();
      const now = Date.now();
      const remaining = deadlineMs - now;

      if (remaining <= 0) {
        setSlaRemaining(null);
        setSlaRemainingMs(0);
        return;
      }

      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      setSlaRemaining(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      setSlaRemainingMs(remaining);
    };

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [slaDeadline]);

  const handleOpenAtendimento = async () => {
    if (!conversation) return;
    if (!conversation.client_id) {
      toast.warning("Vincule um cliente antes de abrir o atendimento", {
        description: "Use a barra lateral para vincular um cliente à conversa.",
      });
      return;
    }
    if (!tenant?.id) return;

    setOpeningAtendimento(true);
    try {
      const { data: clientData } = await (await import("@/integrations/supabase/client")).supabase
        .from("clients").select("cpf, credor").eq("id", conversation.client_id).single();

      if (!clientData) {
        toast.error("Cliente não encontrado");
        return;
      }

      const session = await findOrCreateSession({
        tenantId: tenant.id,
        clientId: conversation.client_id,
        clientCpf: clientData.cpf,
        credor: clientData.credor,
        channel: "whatsapp",
        actor: "operator",
        assignedTo: profile?.id,
        sourceConversationId: conversation.id,
      });

      navigate(`/atendimento/${conversation.client_id}?sessionId=${session.id}&channel=whatsapp`);
    } catch (err) {
      console.error("[ChatPanel] Error opening atendimento:", err);
      toast.error("Erro ao abrir atendimento");
    } finally {
      setOpeningAtendimento(false);
    }
  };

  const handleSend = (text: string) => {
    onSend(text, replyTo?.id || null);
    setReplyTo(null);
  };

  const handleStatusChange = (status: string) => {
    // Fechamento manual exige tabulação
    if (status === "closed" && conversation && conversation.status !== "closed") {
      setCloseOpen(true);
      return;
    }
    onStatusChange(status);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35]">
        <div className="text-center text-muted-foreground">
          <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione uma conversa para iniciar</p>
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    open: "Aberta",
    waiting: "Aguardando",
    closed: "Fechada",
  };

  const slaExpired = isOfficialApi && slaDeadline && new Date(slaDeadline) < new Date();
  const FOUR_HOURS = 4 * 3600000;
  const ONE_HOUR = 3600000;
  const slaColor = slaRemainingMs > FOUR_HOURS ? "text-[#25d366]" : slaRemainingMs > ONE_HOUR ? "text-yellow-500" : "text-destructive";

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - WhatsApp style */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#dfe5e7] dark:bg-[#6b7c85] flex items-center justify-center overflow-hidden">
            {(conversation as any).remote_avatar_url ? (
              <img
                src={(conversation as any).remote_avatar_url}
                alt={conversation.remote_name || "avatar"}
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <User className="w-5 h-5 text-[#cfd7db] dark:text-[#aebac1]" />
            )}
          </div>
          <div>
            <div className="font-medium text-[15px] flex items-center gap-2 text-foreground">
              {clientInfo?.nome_completo || clientInfo?.name || (conversation.remote_name && conversation.remote_name !== conversation.remote_phone ? conversation.remote_name : conversation.remote_phone)}
              {(() => {
                const convDisps = dispositionAssignments.filter(a => a.conversation_id === conversation.id);
                return convDisps.map(a => {
                  const dt = dispositionTypes.find(d => d.id === a.disposition_type_id);
                  if (!dt) return null;
                  return (
                    <Badge
                      key={dt.id}
                      className="text-[10px] h-4 px-1.5 border-0 text-white shrink-0"
                      style={{ backgroundColor: dt.color || 'hsl(var(--muted))' }}
                    >
                      {dt.label}
                    </Badge>
                  );
                });
              })()}
              {/* SLA countdown timer */}
              {isOfficialApi && slaRemaining && !slaExpired && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={`text-[10px] h-4 gap-0.5 cursor-help ${slaColor} border-current ${slaRemainingMs < ONE_HOUR ? "animate-pulse" : ""}`}>
                        <Clock className="w-2.5 h-2.5" />
                        {slaRemaining}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Tempo restante do SLA: {slaRemaining}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Auto-close interno (regra do tenant) — separado do SLA oficial */}
              <AutoCloseIndicator
                conversationStatus={conversation.status}
                lastInteractionAt={conversation.last_interaction_at || conversation.last_message_at}
              />
              {slaExpired && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="destructive" className="text-[10px] h-4 gap-0.5 cursor-help">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        SLA Expirado
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px] text-center">
                      <p>Prazo de atendimento (SLA) expirado em {new Date(slaDeadline!).toLocaleString("pt-BR")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {conversation.remote_phone}
              {instanceName && (
                <Badge variant="outline" className="text-[10px] h-4">
                  {instanceName}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleOpenAtendimento}
                  disabled={openingAtendimento}
                  aria-label="Atendimento"
                >
                  {openingAtendimento ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Headphones className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{conversation.client_id ? "Abrir tela de atendimento/negociação" : "Vincule um cliente primeiro"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setTransferOpen(true)}
                  aria-label="Transferir conversa"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Transferir esta conversa para outro operador do tenant</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {conversation.status === "open" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleStatusChange("closed")}
                    aria-label="Fechar conversa"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Fechar conversa</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {conversation.status === "closed" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleStatusChange("open")}
                    aria-label="Abrir conversa"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Abrir conversa</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-8 w-8">
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Accept-to-read lock: operator must accept waiting conversation before reading */}
      {(() => {
        const isAdmin = profile?.role === "admin";
        const isLocked = conversation.status === "waiting" && !isAdmin;

        return (
          <>
            {/* Waiting banner (only for admins viewing waiting conversations) */}
            {conversation.status === "waiting" && isAdmin && (
              <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    Conversa aguardando atendimento (modo auditoria)
                  </span>
                </div>
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs bg-[#25d366] hover:bg-[#20bd5a] text-white"
                  onClick={() => onStatusChange("open")}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Aceitar Conversa
                </Button>
              </div>
            )}

            {/* Alerta multi-instância (não bloqueia, apenas contextualiza) */}
            <MultiInstanceAlert
              clientId={conversation.client_id}
              conversationId={conversation.id}
            />

            {/* Messages - WhatsApp wallpaper bg */}
            <div
              className="flex-1 overflow-hidden relative"
              style={{
                backgroundColor: "#efeae2",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1cdc7' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              <ScrollArea
                ref={scrollContainerRef}
                className={`h-full px-[5%] py-3 ${isLocked ? "blur-md select-none pointer-events-none" : ""}`}
                aria-hidden={isLocked}
              >
                <div className="space-y-[1px]">
                  {loadingOlder && (
                    <div className="space-y-2 py-3 animate-fade-in">
                      <div className="flex justify-start">
                        <Skeleton className="h-12 w-2/3 rounded-2xl" />
                      </div>
                      <div className="flex justify-end">
                        <Skeleton className="h-12 w-1/2 rounded-2xl" />
                      </div>
                      <div className="flex justify-start">
                        <Skeleton className="h-12 w-3/5 rounded-2xl" />
                      </div>
                    </div>
                  )}
                  {messageItems.map((item) => {
                    if (item.type === "separator") {
                      return <DateSeparator key={item.key} date={item.date} />;
                    }
                    return (
                      <ChatMessageBubble
                        key={item.key}
                        message={item.message}
                        onReply={(m) => setReplyTo(m)}
                        allMessages={messages}
                        isOfficialApi={isOfficialApi}
                      />
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              {/* Lock overlay */}
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
                  <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto">
                      <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold text-foreground">
                        Conversa aguardando atendimento
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Aceite a conversa para visualizar o histórico de mensagens e iniciar o atendimento.
                      </p>
                    </div>
                    {conversation.unread_count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {conversation.unread_count} {conversation.unread_count === 1 ? "mensagem não lida" : "mensagens não lidas"}
                      </Badge>
                    )}
                    <Button
                      autoFocus
                      size="lg"
                      className="w-full gap-2 bg-[#25d366] hover:bg-[#20bd5a] text-white"
                      onClick={() => onStatusChange("open")}
                    >
                      <UserCheck className="w-4 h-4" />
                      Aceitar Conversa
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* AI Suggestion - hidden when locked */}
            {!isLocked && conversation && messages.length > 0 && (
              <div className="px-4 py-1.5 border-t border-border/50 bg-card">
                <AISuggestion messages={messages} clientInfo={clientInfo} onSend={(text) => handleSend(text)} disabled={sending} />
              </div>
            )}
          </>
        );
      })()}


      {/* Input - WhatsApp style */}
      <ChatInput
        onSend={handleSend}
        onSendMedia={onSendMedia}
        onSendAudio={onSendAudio}
        onSendInternalNote={onSendInternalNote}
        quickReplies={quickReplies}
        disabled={conversation.status === "waiting"}
        clientInfo={clientInfo}
        operatorName={operatorName}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        conversationStatus={conversation.status as "open" | "waiting" | "closed"}
      />

      {conversation && (
        <>
          <TransferConversationDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            conversationId={conversation.id}
          />
          <CloseConversationDialog
            open={closeOpen}
            onOpenChange={setCloseOpen}
            conversationId={conversation.id}
            tenantId={conversation.tenant_id || tenant?.id || ""}
            onConfirm={async () => onStatusChange("closed")}
          />
        </>
      )}
    </div>
  );
};

export default ChatPanel;
