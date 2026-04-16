import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
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

  if (others.length === 0) return null;

  const first = others[0];
  const extra = others.length - 1;

  return (
    <div className="mx-4 mt-2 rounded-md border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/60 px-3 py-2 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <div className="text-xs text-amber-900 dark:text-amber-200 leading-snug">
        <div className="font-medium">
          Este cliente já possui contato recente em outro número.
        </div>
        <div className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
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
    </div>
  );
};

export default MultiInstanceAlert;
