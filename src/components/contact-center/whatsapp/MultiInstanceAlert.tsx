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
  const extra = others.length - 1;

  return (
    <div className="mx-4 mt-2 rounded-md border border-border/50 bg-muted/40 backdrop-blur-sm px-3 py-2 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="text-xs text-muted-foreground leading-snug flex-1">
        <div className="font-medium text-foreground/80">
          Este cliente já possui contato recente em outro número.
        </div>
        <div className="mt-0.5">
          {first.instance_name || "Outra instância"} · {first.remote_phone}
          {first.assigned_name && <> · operador: {first.assigned_name}</>}
          {" · "}
          {first.last_interaction_at
            ? `última interação ${formatDistanceToNow(new Date(first.last_interaction_at), { addSuffix: true, locale: ptBR })}`
            : "sem interação registrada"}
          {" · "}status: {first.status}
          {extra > 0 && <> · +{extra} outra{extra > 1 ? "s" : ""}</>}
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
        aria-label="Fechar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default MultiInstanceAlert;
