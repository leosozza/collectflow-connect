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

  return null;
};

export default AISummaryPanel;
