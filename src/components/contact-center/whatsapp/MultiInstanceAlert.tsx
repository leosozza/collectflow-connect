import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OtherConv {
  conversation_id: string;
  instance_id: string | null;
  instance_name: string | null;
  remote_phone: string;
  status: string;
  assigned_to: string | null;
  assigned_name: string | null;
  last_interaction_at: string | null;
}

interface MultiInstanceAlertProps {
  clientId: string | null;
  conversationId: string;
  windowHours?: number;
}

const MultiInstanceAlert = ({ clientId, conversationId, windowHours = 48 }: MultiInstanceAlertProps) => {
  const [others, setOthers] = useState<OtherConv[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [conversationId]);

  useEffect(() => {
    if (!clientId) {
      setOthers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_other_active_conversations" as any, {
        _client_id: clientId,
        _exclude_conv_id: conversationId,
        _window_hours: windowHours,
      });
      if (cancelled) return;
      if (error) {
        console.warn("[MultiInstanceAlert]", error);
        return;
      }
      setOthers((data as OtherConv[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, conversationId, windowHours]);

  if (others.length === 0 || dismissed) return null;

  const first = others[0];
  const instanceLabel = first.instance_name || "outra instância";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none p-4">
      <div className="pointer-events-auto relative max-w-md w-full rounded-xl border border-border/60 bg-background/95 backdrop-blur-md shadow-lg px-6 py-5 flex flex-col items-center text-center gap-3 animate-fade-in">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Fechar aviso"
        >
          <X className="w-4 h-4" />
        </button>
        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
        <div className="text-sm font-medium text-foreground">
          Este cliente possui contato recente com {instanceLabel}.
        </div>
        <div className="text-xs text-muted-foreground">
          {first.last_interaction_at
            ? `Última alteração ${formatDistanceToNow(new Date(first.last_interaction_at), { addSuffix: true, locale: ptBR })}`
            : "Sem interação registrada"}
        </div>
      </div>
    </div>
  );
};

export default MultiInstanceAlert;
