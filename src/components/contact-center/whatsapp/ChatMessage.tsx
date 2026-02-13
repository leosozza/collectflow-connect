import { ChatMessage as ChatMessageType } from "@/services/conversationService";
import { Check, CheckCheck, Clock, AlertCircle, StickyNote } from "lucide-react";
import { format } from "date-fns";

interface ChatMessageProps {
  message: ChatMessageType;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3 text-muted-foreground" />,
  sent: <Check className="w-3 h-3 text-muted-foreground" />,
  delivered: <CheckCheck className="w-3 h-3 text-muted-foreground" />,
  read: <CheckCheck className="w-3 h-3 text-blue-500" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const ChatMessageBubble = ({ message }: ChatMessageProps) => {
  const isOutbound = message.direction === "outbound";
  const isInternal = message.is_internal;

  const renderContent = () => {
    switch (message.message_type) {
      case "image":
        return (
          <div>
            {message.media_url && (
              <img
                src={message.media_url}
                alt="Imagem"
                className="max-w-[280px] rounded-lg mb-1"
                loading="lazy"
              />
            )}
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
        );
      case "audio":
        return (
          <audio controls className="max-w-[250px]">
            <source src={message.media_url || ""} type={message.media_mime_type || "audio/ogg"} />
          </audio>
        );
      case "video":
        return (
          <div>
            {message.media_url && (
              <video controls className="max-w-[280px] rounded-lg mb-1">
                <source src={message.media_url} type={message.media_mime_type || "video/mp4"} />
              </video>
            )}
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
        );
      case "document":
        return (
          <a
            href={message.media_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline text-primary"
          >
            📎 {message.content || "Documento"}
          </a>
        );
      case "sticker":
        return message.media_url ? (
          <img src={message.media_url} alt="Sticker" className="w-24 h-24" loading="lazy" />
        ) : (
          <span className="text-sm text-muted-foreground">Sticker</span>
        );
      default:
        return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  if (isInternal) {
    return (
      <div className="flex justify-center mb-1">
        <div className="max-w-[80%] px-3 py-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700">
          <div className="flex items-center gap-1 mb-0.5">
            <StickyNote className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
            <span className="text-[10px] font-medium text-yellow-700 dark:text-yellow-400">Nota interna</span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words text-yellow-900 dark:text-yellow-100">{message.content}</p>
          <div className="flex justify-end mt-0.5">
            <span className="text-[10px] text-yellow-600 dark:text-yellow-400">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-1`}>
      <div
        className={`max-w-[70%] px-3 py-1.5 rounded-lg ${
          isOutbound
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border rounded-bl-sm"
        }`}
      >
        {renderContent()}
        <div className={`flex items-center gap-1 justify-end mt-0.5 ${isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          <span className="text-[10px]">
            {format(new Date(message.created_at), "HH:mm")}
          </span>
          {isOutbound && statusIcons[message.status]}
        </div>
      </div>
    </div>
  );
};

export default ChatMessageBubble;
