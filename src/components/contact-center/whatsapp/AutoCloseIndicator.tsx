import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface AutoCloseIndicatorProps {
  conversationStatus: string;
  lastInteractionAt: string | null | undefined;
}

const AutoCloseIndicator = ({ conversationStatus, lastInteractionAt }: AutoCloseIndicatorProps) => {
  const { tenant } = useTenant();
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState(24);
  const [statuses, setStatuses] = useState<string[]>(["open"]);
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      const { data } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenant.id)
        .single();
      const ac = (data?.settings as any)?.whatsapp_autoclose || {};
      setEnabled(!!ac.enabled);
      setHours(Number(ac.inactivity_hours) || 24);
      setStatuses(
        Array.isArray(ac.applies_to_statuses) && ac.applies_to_statuses.length > 0
          ? ac.applies_to_statuses
          : ["open"]
      );
    })();
  }, [tenant?.id]);

  useEffect(() => {
    if (!enabled || !lastInteractionAt || !statuses.includes(conversationStatus)) {
      setRemaining(null);
      return;
    }
    const update = () => {
      const deadline = new Date(lastInteractionAt).getTime() + hours * 3600_000;
      const now = Date.now();
      const ms = deadline - now;
      if (ms <= 0) {
        setRemaining("0h 0m");
        return;
      }
      const h = Math.floor(ms / 3600_000);
      const m = Math.floor((ms % 3600_000) / 60_000);
      setRemaining(`${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [enabled, lastInteractionAt, hours, statuses, conversationStatus]);

  if (!enabled || !remaining) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-[10px] h-4 gap-0.5 cursor-help text-muted-foreground border-muted-foreground/40">
            <Timer className="w-2.5 h-2.5" />
            {remaining}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-center">
          <p>Fechamento automático interno em {remaining} (regra do tenant, não é o SLA oficial)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AutoCloseIndicator;
