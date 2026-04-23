import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useAtendimentoModalSafe } from "@/hooks/useAtendimentoModal";
import { dialClientPhone } from "@/services/callService";
import { formatPhone } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface CallButtonProps {
  phone: string | null | undefined;
  clientId?: string | null;
  size?: "sm" | "icon";
  className?: string;
}

/**
 * Botão de telefone reutilizável que dispara discagem via 3CPlus.
 * Comportamento conforme `dialClientPhone`:
 *  - Conectado: disca direto.
 *  - Desconectado: grava pendingCall + redireciona para /contact-center/telefonia.
 *  - Em chamada (on_call/acw): desabilitado.
 */
const CallButton = ({ phone, clientId, size = "icon", className }: CallButtonProps) => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const { liveAgentState } = useAtendimentoModalSafe();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const cleanPhone = (phone || "").replace(/\D/g, "");
  const agentId = (profile as any)?.threecplus_agent_id as number | null | undefined;
  const status = liveAgentState?.status;

  const inCall = status === 2 || status === 3;
  const disabled = !cleanPhone || busy || inCall;

  const tooltip = (() => {
    if (!cleanPhone) return "Sem telefone cadastrado";
    if (inCall) return "Finalize a chamada atual antes de discar";
    return `Ligar para ${formatPhone(cleanPhone)}`;
  })();

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || !tenant?.id) return;
    setBusy(true);
    try {
      await dialClientPhone({
        tenantId: tenant.id,
        agentId,
        phone: cleanPhone,
        clientId,
        agentStatus: status,
        onNeedsConnection: () => navigate("/contact-center/telefonia"),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={size}
            disabled={disabled}
            onClick={handleClick}
            aria-label={tooltip}
            className={cn(
              "rounded-full text-green-600 hover:text-green-700 hover:bg-green-500/10",
              size === "icon" ? "h-7 w-7" : "h-7 px-2",
              disabled && "opacity-40 hover:bg-transparent",
              className,
            )}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CallButton;
