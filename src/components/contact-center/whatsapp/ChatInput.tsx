import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, StickyNote } from "lucide-react";
import EmojiPicker from "./EmojiPicker";
import AudioRecorder from "./AudioRecorder";
import { QuickReply } from "@/services/conversationService";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendMedia: (file: File) => void;
  onSendAudio: (blob: Blob) => void;
  onSendInternalNote?: (text: string) => void;
  quickReplies?: QuickReply[];
  disabled?: boolean;
}

const ChatInput = ({ onSend, onSendMedia, onSendAudio, onSendInternalNote, quickReplies = [], disabled }: ChatInputProps) => {
  const [text, setText] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [filteredReplies, setFilteredReplies] = useState<QuickReply[]>([]);
  const [isInternalMode, setIsInternalMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick replies: detect "/" at start
  useEffect(() => {
    if (text.startsWith("/") && quickReplies.length > 0) {
      const query = text.slice(1).toLowerCase();
      const matches = quickReplies.filter(
        (qr) =>
          qr.shortcut.toLowerCase().includes(query) ||
          qr.content.toLowerCase().includes(query)
      );
      setFilteredReplies(matches);
      setShowQuickReplies(matches.length > 0);
    } else {
      setShowQuickReplies(false);
    }
  }, [text, quickReplies]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (isInternalMode && onSendInternalNote) {
      onSendInternalNote(trimmed);
    } else {
      onSend(trimmed);
    }
    setText("");
    setIsInternalMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showQuickReplies && filteredReplies.length > 0) {
        selectQuickReply(filteredReplies[0]);
      } else {
        handleSend();
      }
    }
    if (e.key === "Escape" && showQuickReplies) {
      setShowQuickReplies(false);
    }
  };

  const selectQuickReply = (qr: QuickReply) => {
    setText(qr.content);
    setShowQuickReplies(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMedia(file);
      e.target.value = "";
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  return (
    <div className="border-t border-border bg-card p-3 relative">
      {/* Quick replies dropdown */}
      {showQuickReplies && (
        <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-popover border border-border rounded-lg shadow-lg z-10">
          <ScrollArea className="max-h-[200px]">
            {filteredReplies.map((qr) => (
              <button
                key={qr.id}
                onClick={() => selectQuickReply(qr)}
                className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-primary">/{qr.shortcut}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 rounded">{qr.category}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{qr.content}</p>
              </button>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* Internal note indicator */}
      {isInternalMode && (
        <div className="flex items-center gap-1.5 mb-1.5 px-1">
          <StickyNote className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">Nota interna (não será enviada ao cliente)</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex items-center gap-0.5">
          <EmojiPicker onSelect={handleEmojiSelect} disabled={disabled} />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Anexar arquivo"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <AudioRecorder onRecorded={onSendAudio} disabled={disabled} />
          {onSendInternalNote && (
            <Button
              size="icon"
              variant={isInternalMode ? "default" : "ghost"}
              className={`h-8 w-8 shrink-0 ${isInternalMode ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
              onClick={() => setIsInternalMode(!isInternalMode)}
              disabled={disabled}
              title="Nota interna"
            >
              <StickyNote className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isInternalMode ? "Escreva uma nota interna..." : "Digite uma mensagem... (/ para respostas rápidas)"}
          className={`resize-none min-h-[40px] max-h-[120px] text-sm ${isInternalMode ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20" : ""}`}
          rows={1}
          disabled={disabled}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className={`shrink-0 ${isInternalMode ? "bg-yellow-500 hover:bg-yellow-600" : ""}`}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInput;
