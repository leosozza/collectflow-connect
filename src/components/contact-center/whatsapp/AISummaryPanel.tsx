import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Brain, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "@/services/conversationService";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AISummaryPanelProps {
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
  onSuggestedTags?: (tags: string[]) => void;
}

const INTENT_LABELS: Record<string, string> = {
  negociacao: "Negociação",
  pagamento: "Pagamento",
  duvida: "Dúvida",
  reclamacao: "Reclamação",
  cancelamento: "Cancelamento",
  informacao: "Informação",
  acordo: "Acordo",
  inadimplencia: "Inadimplência",
  outro: "Outro",
};

const INTENT_COLORS: Record<string, string> = {
  negociacao: "#f59e0b",
  pagamento: "#22c55e",
  duvida: "#3b82f6",
  reclamacao: "#ef4444",
  cancelamento: "#ef4444",
  informacao: "#06b6d4",
  acordo: "#22c55e",
  inadimplencia: "#f97316",
  outro: "#8b5cf6",
};

const AISummaryPanel = ({ messages, clientInfo, onSuggestedTags }: AISummaryPanelProps) => {
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [classification, setClassification] = useState<{
    intent: string;
    confidence: number;
    suggested_tags: string[];
    summary: string;
  } | null>(null);
  const [loadingClassify, setLoadingClassify] = useState(false);

  const handleSummarize = async () => {
    if (messages.length === 0) {
      toast.error("Nenhuma mensagem para resumir");
      return;
    }
    setLoadingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-ai-suggest", {
        body: {
          action: "summarize",
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
        return;
      }
      setSummary(data?.text || "");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar resumo");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleClassify = async () => {
    if (messages.length === 0) {
      toast.error("Nenhuma mensagem para classificar");
      return;
    }
    setLoadingClassify(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-ai-suggest", {
        body: {
          action: "classify",
          messages: messages.map((m) => ({
            direction: m.direction,
            content: m.content,
            message_type: m.message_type,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setClassification(data);
      if (data?.suggested_tags && onSuggestedTags) {
        onSuggestedTags(data.suggested_tags);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao classificar");
    } finally {
      setLoadingClassify(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Summary */}
      <Card>
        <CardHeader className="p-3 pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Resumo IA
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={handleSummarize}
              disabled={loadingSummary || messages.length === 0}
            >
              {loadingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              Gerar
            </Button>
          </div>
        </CardHeader>
        {summary && (
          <CardContent className="p-3 pt-1">
            <div className="text-xs prose prose-xs max-w-none text-foreground">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader className="p-3 pb-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs flex items-center gap-1">
              <Brain className="w-3 h-3" />
              Classificação
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={handleClassify}
              disabled={loadingClassify || messages.length === 0}
            >
              {loadingClassify ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              Classificar
            </Button>
          </div>
        </CardHeader>
        {classification && (
          <CardContent className="p-3 pt-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ borderColor: INTENT_COLORS[classification.intent], color: INTENT_COLORS[classification.intent] }}
              >
                {INTENT_LABELS[classification.intent] || classification.intent}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {Math.round(classification.confidence * 100)}% confiança
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{classification.summary}</p>
            {classification.suggested_tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Tag className="w-3 h-3 text-muted-foreground" />
                {classification.suggested_tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default AISummaryPanel;
