import { ChatMessage as ChatMessageType } from "@/services/conversationService";
import { Check, CheckCheck, Clock, AlertCircle, StickyNote, Reply } from "lucide-react";
import { format } from "date-fns";

interface ChatMessageProps {
  message: ChatMessageType;
  onReply?: (message: ChatMessageType) => void;
  allMessages?: ChatMessageType[];
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3 text-[#667781]" />,
  sent: <Check className="w-3 h-3 text-[#667781]" />,
  delivered: <CheckCheck className="w-3 h-3 text-[#667781]" />,
  read: <CheckCheck className="w-3 h-3 text-[#53bdeb]" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const ChatMessageBubble = ({ message, onReply, allMessages = [] }: ChatMessageProps) => {
  const isOutbound = message.direction === "outbound";
  const isInternal = message.is_internal;

  // Find replied message
  const repliedMessage = message.reply_to_message_id
    ? allMessages.find((m) => m.id === message.reply_to_message_id) ?? null
    : null;
  const hasReplyRef = !!message.reply_to_message_id;

  const renderContent = () => {
    switch (message.message_type) {
      case "image":
        return (
          <div>
            {message.media_url && (
              <img
                src={message.media_url}
                alt="Imagem"
                className="max-w-[280px] rounded-md mb-1"
                loading="lazy"
              />
            )}
            {message.content && <p className="text-[14.2px] leading-[19px]">{message.content}</p>}
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
              <video controls className="max-w-[280px] rounded-md mb-1">
                <source src={message.media_url} type={message.media_mime_type || "video/mp4"} />
              </video>
            )}
            {message.content && <p className="text-[14.2px] leading-[19px]">{message.content}</p>}
          </div>
        );
      case "document":
        return (
          <a
            href={message.media_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14.2px] underline text-primary"
          >
            📎 {message.content || "Documento"}
          </a>
        );
      case "sticker":
        return message.media_url ? (
          <img src={message.media_url} alt="Sticker" className="w-24 h-24" loading="lazy" />
        ) : (
          <span className="text-[14.2px] text-muted-foreground">Sticker</span>
        );
      default:
        return <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  if (isInternal) {
    return (
      <div className="flex justify-center my-1">
        <div className="max-w-[75%] px-3 py-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 shadow-sm">
          <div className="flex items-center gap-1 mb-0.5">
            <StickyNote className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
            <span className="text-[11px] font-medium text-yellow-700 dark:text-yellow-400">Nota interna</span>
          </div>
          <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words text-yellow-900 dark:text-yellow-100">{message.content}</p>
          <div className="flex justify-end mt-0.5">
            <span className="text-[11px] text-yellow-600 dark:text-yellow-400">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-[2px] group`}>
      <div className="flex items-center gap-1">
        {/* Reply button for inbound messages — appears on hover */}
        {!isOutbound && onReply && (
          <button
            onClick={() => onReply(message)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 order-2"
            title="Responder"
          >
            <Reply className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {/* Reply button removed for outbound — reply only allowed on inbound messages */}
        <div
          className={`relative max-w-[65%] px-[9px] pt-[6px] pb-[8px] shadow-sm ${
            isOutbound
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-lg rounded-tr-none"
              : "bg-card text-foreground border border-border/40 rounded-lg rounded-tl-none"
          } ${!isOutbound ? "order-1" : ""}`}
        >
          {/* Reply preview */}
          {hasReplyRef && (
            <div
              className={`mb-1 px-2 py-1 rounded text-[12px] leading-[16px] border-l-[3px] ${
                isOutbound
                  ? "bg-[#c8efc3] dark:bg-[#004a3f] border-l-[#25d366]"
                  : "bg-muted/50 border-l-primary"
              }`}
            >
              {repliedMessage ? (
                <>
                  <span className="font-medium text-[11px] block">
                    {repliedMessage.direction === "inbound" ? "Cliente" : "Operador"}
                  </span>
                  <span className="line-clamp-2 text-muted-foreground">
                    {repliedMessage.content || `[${repliedMessage.message_type}]`}
                  </span>
                </>
              ) : (
                <span className="italic text-muted-foreground">Mensagem respondida</span>
              )}
            </div>
          )}
          {renderContent()}
          <div className={`flex items-center gap-1 justify-end mt-[2px] -mb-[2px] ${
            isOutbound ? "text-[#667781] dark:text-[#ffffff99]" : "text-muted-foreground"
          }`}>
            <span className="text-[11px] leading-none">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
            {isOutbound && statusIcons[message.status]}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessageBubble;
