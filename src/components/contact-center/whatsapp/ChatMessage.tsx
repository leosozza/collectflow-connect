import { useState } from "react";
import { ChatMessage as ChatMessageType, deleteChatMessageForRecipient, editChatMessage } from "@/services/conversationService";
import { Check, CheckCheck, Clock, AlertCircle, StickyNote, Reply, FileText, FileAudio, Download, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatWhatsAppText, stripWhatsAppMarkers } from "@/lib/whatsappFormat";

interface ChatMessageProps {
  message: ChatMessageType;
  onReply?: (message: ChatMessageType) => void;
  allMessages?: ChatMessageType[];
  isOfficialApi?: boolean;
}

const statusIcons: Record<string, React.ReactNode> = {
  sending: <Clock className="w-3 h-3 text-[#667781] animate-pulse" />,
  pending: <Clock className="w-3 h-3 text-[#667781]" />,
  sent: <Check className="w-3 h-3 text-[#667781]" />,
  delivered: <CheckCheck className="w-3 h-3 text-[#667781]" />,
  read: <CheckCheck className="w-3 h-3 text-[#53bdeb]" />,
  failed: <AlertCircle className="w-3 h-3 text-destructive" />,
};

const ChatMessageBubble = ({ message, onReply, allMessages = [], isOfficialApi = false }: ChatMessageProps) => {
  const isOutbound = message.direction === "outbound";
  const isInternal = message.is_internal;

  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(message.content || "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const repliedMessage = message.reply_to_message_id
    ? allMessages.find((m) => m.id === message.reply_to_message_id) ?? null
    : null;
  const hasReplyRef = !!message.reply_to_message_id;

  const metadata = (message as any).metadata as Record<string, any> | null;
  const sendError = metadata?.send_error as string | undefined;
  const providerError = metadata?.provider_error as string | undefined;
  const errorTooltip = sendError || providerError || null;
  const transcription = metadata?.transcription as string | undefined;
  const transcriptionError = metadata?.transcription_error as string | undefined;

  const isDeleted = !!message.deleted_for_recipient_at;
  const isEdited = !!message.edited_at;
  const isOptimistic = (message as any).__optimistic === true;
  const ageMs = Date.now() - new Date(message.created_at).getTime();
  const canEdit =
    isOutbound &&
    !isInternal &&
    !isDeleted &&
    !isOptimistic &&
    message.message_type === "text" &&
    message.status !== "failed" &&
    ageMs <= 15 * 60 * 1000;
  const editDisabledReason = isOfficialApi
    ? "Edição não suportada nas instâncias oficiais (Meta)"
    : !canEdit && isOutbound && message.message_type === "text"
      ? "Edição permitida apenas nos primeiros 15 minutos"
      : null;
  const canDelete =
    isOutbound &&
    !isInternal &&
    !isDeleted &&
    !isOptimistic &&
    message.status !== "failed" &&
    !!(message as any).provider_message_id || !!message.external_id;
  const showActionsMenu = isOutbound && !isInternal && !isOptimistic;

  const handleDocumentDownload = async (url: string, filename: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleConfirmEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed) {
      toast.error("Texto não pode ficar vazio");
      return;
    }
    if (trimmed === (message.content || "")) {
      setEditOpen(false);
      return;
    }
    setBusy(true);
    try {
      await editChatMessage(message.id, trimmed);
      toast.success("Mensagem editada");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao editar mensagem");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    setBusy(true);
    try {
      await deleteChatMessageForRecipient(message.id);
      toast.success("Mensagem excluída para o destinatário");
      setConfirmDelete(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir mensagem");
    } finally {
      setBusy(false);
    }
  };

  // Visual class applied to media/text content when deleted-for-recipient
  const deletedClass = isDeleted ? "line-through opacity-50" : "";

  const renderContent = () => {
    switch (message.message_type) {
      case "image":
        return (
          <div className={isDeleted ? "relative" : ""}>
            {message.media_url && (
              <img
                src={message.media_url}
                alt="Imagem"
                className={`max-w-[280px] rounded-md mb-1 cursor-pointer hover:opacity-90 transition-opacity ${isDeleted ? "opacity-50" : ""}`}
                loading="lazy"
                onClick={() => window.open(message.media_url!, "_blank")}
              />
            )}
            {message.content && (
              <p className={`text-[14.2px] leading-[19px] whitespace-pre-wrap break-words ${deletedClass}`}>
                {formatWhatsAppText(message.content)}
              </p>
            )}
          </div>
        );
      case "audio":
        return (
          <div className={`space-y-1.5 ${isDeleted ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-1.5">
              <audio src={message.media_url || ""} controls className="max-w-[250px]" />
              {message.media_url && (
                <button
                  type="button"
                  onClick={() => handleDocumentDownload(message.media_url!, "audio.mp3")}
                  className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                  title="Baixar áudio"
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {transcription && (
              <div className={`flex items-start gap-1.5 px-2 py-1.5 rounded text-[12px] leading-[16px] ${
                isOutbound ? "bg-[#c8efc3] dark:bg-[#004a3f]" : "bg-muted/50"
              }`}>
                <FileAudio className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <span className="font-medium text-[10px] text-muted-foreground block mb-0.5">Transcrição</span>
                  <span className={`text-foreground/80 whitespace-pre-wrap ${deletedClass}`}>{transcription}</span>
                </div>
              </div>
            )}
            {transcriptionError && !transcription && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground italic">
                <AlertCircle className="w-2.5 h-2.5" />
                <span>Transcrição indisponível</span>
              </div>
            )}
          </div>
        );
      case "video":
        return (
          <div>
            {message.media_url && (
              <video controls className={`max-w-[280px] rounded-md mb-1 ${isDeleted ? "opacity-50" : ""}`}>
                <source src={message.media_url} type={message.media_mime_type || "video/mp4"} />
              </video>
            )}
            {message.content && (
              <p className={`text-[14.2px] leading-[19px] whitespace-pre-wrap break-words ${deletedClass}`}>
                {formatWhatsAppText(message.content)}
              </p>
            )}
          </div>
        );
      case "document": {
        const docFilename = message.content || "Documento";
        const mimeLabel = message.media_mime_type === "application/pdf" ? "PDF"
          : message.media_mime_type?.split("/").pop()?.toUpperCase() || "Arquivo";
        return (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            isOutbound ? "bg-[#c8efc3] dark:bg-[#004a3f]" : "bg-muted/60"
          } ${isDeleted ? "opacity-60" : ""}`}>
            <FileText className="w-8 h-8 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-medium truncate ${deletedClass}`}>{docFilename}</p>
              <p className="text-[11px] text-muted-foreground">{mimeLabel}</p>
            </div>
            {message.media_url && (
              <button
                type="button"
                onClick={() => handleDocumentDownload(message.media_url!, docFilename)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                title="Baixar documento"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        );
      }
      case "sticker":
        return message.media_url ? (
          <img src={message.media_url} alt="Sticker" className={`w-24 h-24 ${isDeleted ? "opacity-50" : ""}`} loading="lazy" />
        ) : (
          <span className="text-[14.2px] text-muted-foreground">Sticker</span>
        );
      default:
        return (
          <p className={`text-[14.2px] leading-[19px] whitespace-pre-wrap break-words ${deletedClass}`}>
            {formatWhatsAppText(message.content)}
          </p>
        );
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
          <p className="text-[14.2px] leading-[19px] whitespace-pre-wrap break-words text-yellow-900 dark:text-yellow-100">{formatWhatsAppText(message.content)}</p>
          <div className="flex justify-end mt-0.5">
            <span className="text-[11px] text-yellow-600 dark:text-yellow-400">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const deletedTooltip = isDeleted
    ? `Excluída para o cliente em ${format(new Date(message.deleted_for_recipient_at!), "dd/MM/yyyy HH:mm")}`
    : null;

  return (
    <div className={`flex w-full ${isOutbound ? "justify-end" : "justify-start"} mb-[2px] group`}>
      {/* Reply button for inbound messages */}
      {!isOutbound && onReply && (
        <button
          onClick={() => onReply(message)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 self-center order-2"
          title="Responder"
        >
          <Reply className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
      <div
        className={`relative max-w-[65%] px-[9px] pt-[6px] pb-[8px] shadow-sm ${
          isOutbound
            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-lg rounded-tr-none"
            : "bg-card text-foreground border border-border/40 rounded-lg rounded-tl-none order-1"
        }`}
      >
        {/* Action menu for outbound messages */}
        {showActionsMenu && (
          <div className={`absolute top-1 ${isOutbound ? "right-1" : "left-1"} opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-0.5 rounded-full bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20"
                  aria-label="Ações da mensagem"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOutbound ? "end" : "start"} className="w-48">
                {onReply && (
                  <>
                    <DropdownMenuItem onClick={() => onReply(message)}>
                      <Reply className="w-4 h-4 mr-2" /> Responder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {message.message_type === "text" && (
                  <DropdownMenuItem
                    disabled={!canEdit || isOfficialApi}
                    onClick={() => {
                      setEditText(message.content || "");
                      setEditOpen(true);
                    }}
                    title={editDisabledReason || undefined}
                  >
                    <Pencil className="w-4 h-4 mr-2" /> Editar mensagem
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={!canDelete}
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir para o cliente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

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
                  {repliedMessage.content
                    ? stripWhatsAppMarkers(repliedMessage.content)
                    : `[${repliedMessage.message_type}]`}
                </span>
              </>
            ) : (
              <span className="italic text-muted-foreground">Mensagem respondida</span>
            )}
          </div>
        )}
        {renderContent()}

        {/* Footer: time, edited tag, deleted icon, status */}
        <div className={`flex items-center gap-1 justify-end mt-[2px] -mb-[2px] ${
          isOutbound ? "text-[#667781] dark:text-[#ffffff99]" : "text-muted-foreground"
        }`}>
          {isDeleted && deletedTooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help inline-flex items-center">
                    <Trash2 className="w-3 h-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p>{deletedTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isEdited && !isDeleted && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] italic cursor-help">editada</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs">
                  <p className="font-medium">Texto original</p>
                  <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                    {message.original_content || "(sem registro)"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <span className="text-[11px] leading-none">
            {format(new Date(message.created_at), "HH:mm")}
          </span>
          {isOutbound && (
            message.status === "failed" && errorTooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">{statusIcons[message.status]}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px] text-xs">
                    <p className="font-medium text-destructive">Falha no envio</p>
                    <p className="text-muted-foreground mt-0.5 break-words">{errorTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : statusIcons[message.status]
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!busy) setEditOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mensagem</DialogTitle>
            <DialogDescription>
              A alteração será aplicada também no WhatsApp do cliente. O texto original ficará registrado para auditoria.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            disabled={busy}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmEdit} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={(o) => { if (!busy) setConfirmDelete(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem para o cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              No WhatsApp do cliente a mensagem aparecerá como "Esta mensagem foi apagada".
              Aqui na Rivo ela permanecerá visível, riscada e marcada como excluída, para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={busy} className="bg-destructive hover:bg-destructive/90">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir para o cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatMessageBubble;
