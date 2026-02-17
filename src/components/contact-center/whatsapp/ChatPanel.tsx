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
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>

      {/* AI Suggestion */}
      {conversation && messages.length > 0 && (
        <div className="px-4 py-1.5 border-t border-border/50 bg-card">
          <AISuggestion messages={messages} clientInfo={clientInfo} onSend={onSend} disabled={sending} />
        </div>
      )}

      {/* Input - WhatsApp style */}
      <ChatInput onSend={onSend} onSendMedia={onSendMedia} onSendAudio={onSendAudio} onSendInternalNote={onSendInternalNote} quickReplies={quickReplies} disabled={sending} />
    </div>
  );
};

export default ChatPanel;
