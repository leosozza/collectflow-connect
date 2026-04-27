import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioTower, WifiOff, Loader2, RefreshCw } from "lucide-react";
import type { SocketStatus } from "@/hooks/useThreeCPlusSocket";

interface Props {
  status: SocketStatus;
  lastEventAt: Date | null;
  lastEventName: string | null;
  errorMessage: string | null;
  onReconnect: () => void;
}

export const RealtimeStatusBadge = ({
  status, lastEventAt, lastEventName, errorMessage, onReconnect,
}: Props) => {
  let label = "Tempo real desconectado";
  let helper = "Usando atualização automática (REST).";
  let cls = "border-muted text-muted-foreground gap-1.5";
  let Icon: typeof RadioTower = WifiOff;

  if (status === "connected") {
    label = "Tempo real conectado";
    helper = "Eventos da 3CPLUS chegando ao vivo.";
    cls = "border-emerald-500/40 text-emerald-700 gap-1.5";
    Icon = RadioTower;
  } else if (status === "connecting" || status === "reconnecting") {
    label = status === "connecting" ? "Conectando tempo real…" : "Reconectando tempo real…";
    helper = "Eventos podem demorar alguns segundos.";
    cls = "border-amber-500/40 text-amber-700 gap-1.5";
    Icon = Loader2;
  } else if (status === "error") {
    label = "Erro no tempo real";
    helper = errorMessage || "Falha desconhecida no canal de eventos.";
    cls = "border-destructive/40 text-destructive gap-1.5";
    Icon = WifiOff;
  } else if (status === "idle") {
    label = "Tempo real indisponível";
    helper = "Credenciais 3CPLUS ausentes.";
  }

  const animate = status === "connecting" || status === "reconnecting" ? "animate-spin" : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 cursor-pointer">
          <Badge variant="outline" className={`cursor-pointer transition-colors hover:bg-accent ${cls}`}>
            <Icon className={`w-3 h-3 ${animate}`} />
            {label}
            {lastEventAt && (
              <span className="text-muted-foreground font-normal ml-1">
                {lastEventAt.toLocaleTimeString("pt-BR")}
              </span>
            )}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2" align="end">
        <div className="text-xs text-muted-foreground">{helper}</div>
        {lastEventName && (
          <div className="text-xs">
            <span className="text-muted-foreground">Último evento: </span>
            <span className="font-mono">{lastEventName}</span>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={onReconnect} className="w-full gap-1.5 h-8 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Reconectar socket
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default RealtimeStatusBadge;
