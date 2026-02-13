import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { ChatMessage } from "@/services/conversationService";
import { toast } from "sonner";

interface AISuggestionProps {
  messages: ChatMessage[];
  clientInfo?: {
    nome_completo?: string;
    cpf?: string;
    credor?: string;
    status?: string;
    numero_parcela?: number;
    total_parcelas?: number;
    valor_parcela?: number;
  } | null;
  onSend: (text: string) => void;
  disabled?: boolean;
}

const AISuggestion = ({ messages, clientInfo, onSend, disabled }: AISuggestionProps) => {
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSuggest = async () => {
    if (messages.length === 0) {
      toast.error("Nenhuma mensagem na conversa para analisar");
      return;
    }

    setLoading(true);
    setShowSuggestion(true);
    setSuggestion("");

    abortRef.current = new AbortController();

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/chat-ai-suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          action: "suggest",
          messages: messages.map((m) => ({
            direction: m.direction,
            content: m.content,
            message_type: m.message_type,
          })),
          clientInfo: clientInfo || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao gerar sugestão");
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setSuggestion(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setSuggestion(fullText);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Erro ao gerar sugestão");
        if (!suggestion) setShowSuggestion(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendSuggestion = () => {
    if (!suggestion.trim()) return;
    onSend(suggestion.trim());
    setSuggestion("");
    setShowSuggestion(false);
  };

  const handleDismiss = () => {
    abortRef.current?.abort();
    setSuggestion("");
    setShowSuggestion(false);
    setLoading(false);
  };

  if (!showSuggestion) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={handleSuggest}
        disabled={disabled || messages.length === 0}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Sugestão IA
      </Button>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            Sugestão da IA
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleDismiss}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        <Textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          className="resize-none min-h-[60px] text-sm bg-background"
          rows={3}
          placeholder={loading ? "Gerando sugestão..." : ""}
        />
        <div className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDismiss}>
            Descartar
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSendSuggestion} disabled={!suggestion.trim() || loading}>
            <Send className="w-3 h-3" />
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AISuggestion;
