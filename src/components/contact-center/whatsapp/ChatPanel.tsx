import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, User, PanelRightOpen, PanelRightClose, AlertTriangle, Headphones, Loader2, Clock, UserCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChatMessageBubble from "./ChatMessage";
import ChatInput from "./ChatInput";
import AISuggestion from "./AISuggestion";
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
  operatorName?: string;
  dispositionAssignments?: { conversation_id: string; disposition_type_id: string }[];
  dispositionTypes?: { id: string; label: string; color: string; key: string }[];
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
  operatorName,
  dispositionAssignments = [],
  dispositionTypes = [],
}: ChatPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [openingAtendimento, setOpeningAtendimento] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [slaRemaining, setSlaRemaining] = useState<string | null>(null);
  const [slaRemainingMs, setSlaRemainingMs] = useState<number>(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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

  const slaExpired = slaDeadline && new Date(slaDeadline) < new Date();
  const FOUR_HOURS = 4 * 3600000;
  const ONE_HOUR = 3600000;
  const slaColor = slaRemainingMs > FOUR_HOURS ? "text-[#25d366]" : slaRemainingMs > ONE_HOUR ? "text-yellow-500" : "text-destructive";

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header - WhatsApp style */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#dfe5e7] dark:bg-[#6b7c85] flex items-center justify-center">
            <User className="w-5 h-5 text-[#cfd7db] dark:text-[#aebac1]" />
          </div>
          <div>
            <div className="font-medium text-[15px] flex items-center gap-2 text-foreground">
              {conversation.remote_name || conversation.remote_phone}
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
              {slaRemaining && !slaExpired && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={`text-[10px] h-4 gap-0.5 cursor-help ${slaColor} border-current`}>
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
              {/* SLA expired badge */}
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
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleOpenAtendimento}
                  disabled={openingAtendimento}
                >
                  {openingAtendimento ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Headphones className="w-3.5 h-3.5" />
                  )}
                  Atendimento
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{conversation.client_id ? "Abrir tela de atendimento/negociação" : "Vincule um cliente primeiro"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Select value={conversation.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{statusLabels.open}</SelectItem>
              <SelectItem value="waiting">{statusLabels.waiting}</SelectItem>
              <SelectItem value="closed">{statusLabels.closed}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="h-8 w-8">
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Waiting banner */}
      {conversation.status === "waiting" && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-700 dark:text-amber-300">Conversa aguardando atendimento</span>
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

      {/* Messages - WhatsApp wallpaper bg */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1cdc7' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        <ScrollArea className="h-full px-[5%] py-3">
          <div className="space-y-[1px]">
            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onReply={(m) => setReplyTo(m)}
                allMessages={messages}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* AI Suggestion */}
      {conversation && messages.length > 0 && (
        <div className="px-4 py-1.5 border-t border-border/50 bg-card">
          <AISuggestion messages={messages} clientInfo={clientInfo} onSend={(text) => handleSend(text)} disabled={sending} />
        </div>
      )}

      {/* Input - WhatsApp style */}
      <ChatInput
        onSend={handleSend}
        onSendMedia={onSendMedia}
        onSendAudio={onSendAudio}
        onSendInternalNote={onSendInternalNote}
        quickReplies={quickReplies}
        disabled={sending}
        clientInfo={clientInfo}
        operatorName={operatorName}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
};

export default ChatPanel;
