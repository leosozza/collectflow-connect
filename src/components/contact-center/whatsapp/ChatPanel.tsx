import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, User, PanelRightOpen, PanelRightClose, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChatMessageBubble from "./ChatMessage";
import ChatInput from "./ChatInput";
import AISuggestion from "./AISuggestion";
import { Conversation, ChatMessage } from "@/services/conversationService";

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onSend: (text: string) => void;
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
}: ChatPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
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

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              {conversation.remote_name || conversation.remote_phone}
              {slaDeadline && new Date(slaDeadline) < new Date() && (
                <Badge variant="destructive" className="text-[10px] h-4 gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  SLA
                </Badge>
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

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-0.5">
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* AI Suggestion */}
      {conversation && messages.length > 0 && (
        <div className="px-4 py-1.5 border-t border-border/50">
          <AISuggestion messages={messages} clientInfo={clientInfo} onSend={onSend} disabled={sending} />
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={onSend} onSendMedia={onSendMedia} onSendAudio={onSendAudio} onSendInternalNote={onSendInternalNote} quickReplies={quickReplies} disabled={sending} />
    </div>
  );
};

export default ChatPanel;
