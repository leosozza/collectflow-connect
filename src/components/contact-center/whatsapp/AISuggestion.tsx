import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

  const handleSuggest = async () => {
    if (messages.length === 0) {
      toast.error("Nenhuma mensagem na conversa para analisar");
      return;
    }

    setLoading(true);
    setShowSuggestion(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-ai-suggest", {
        body: {
          action: "suggest",
          messages: messages.map((m) => ({
            direction: m.direction,
            content: m.content,
            message_type: m.message_type,
          })),
          clientInfo: clientInfo || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setShowSuggestion(false);
        return;
      }

      setSuggestion(data?.text || "");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar sugestão");
      setShowSuggestion(false);
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
    setSuggestion("");
    setShowSuggestion(false);
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
          </div>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleDismiss}>
            <X className="w-3 h-3" />
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Gerando sugestão...
          </div>
        ) : (
          <>
            <Textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              className="resize-none min-h-[60px] text-sm bg-background"
              rows={3}
            />
            <div className="flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDismiss}>
                Descartar
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSendSuggestion} disabled={!suggestion.trim()}>
                <Send className="w-3 h-3" />
                Enviar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AISuggestion;
