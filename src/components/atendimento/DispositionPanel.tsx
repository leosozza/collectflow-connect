import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Headset, ChevronRight, Handshake, CalendarClock, Check
} from "lucide-react";
import { DispositionType, getDispositionTypes, getCustomDispositionList } from "@/services/dispositionService";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface DispositionPanelProps {
  onDisposition: (type: DispositionType, notes?: string, scheduledCallback?: string) => Promise<void>;
  onNegotiate: () => void;
  loading?: boolean;
}

const DEFAULT_GROUP_MAP: Record<string, string> = {
  callback: "agendar",
  voicemail: "resultado",
  interrupted: "resultado",
  no_answer: "resultado",
  wrong_contact: "contato",
  promise: "contato",
};

const DispositionPanel = ({ onDisposition, onNegotiate, loading }: DispositionPanelProps) => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const [selected, setSelected] = useState<string | null>(null);
  const [callbackDate, setCallbackDate] = useState("");

  const dispositionTypes = useMemo(() => getDispositionTypes(settings), [settings]);
  const dispositionList = useMemo(() => getCustomDispositionList(settings), [settings]);

  const handleDisposition = async (type: string) => {
    try {
      setSelected(type);
      await onDisposition(type);
      toast.success(`Tabulação "${dispositionTypes[type] || type}" registrada`);
    } catch {
      toast.error("Erro ao registrar tabulação");
    }
  };

  const handleCallback = async () => {
    if (!callbackDate) { toast.error("Informe a data/hora do retorno"); return; }
    try {
      await onDisposition("callback", undefined, callbackDate);
      setCallbackDate("");
      toast.success("Retorno agendado com sucesso");
    } catch {
      toast.error("Erro ao agendar retorno");
    }
  };

  const resultadoGroup = dispositionList.filter(d => {
    const g = d.group || DEFAULT_GROUP_MAP[d.key];
    return g === "resultado";
  });
  const contatoGroup = dispositionList.filter(d => {
    const g = d.group || DEFAULT_GROUP_MAP[d.key];
    return g === "contato";
  });
  const otherGroup = dispositionList.filter(d => {
    const g = d.group || DEFAULT_GROUP_MAP[d.key];
    return !g || !["agendar", "resultado", "contato"].includes(g);
  });

  const renderChip = (d: { key: string; label: string }) => {
    const isSelected = selected === d.key;
    return (
      <button
        key={d.key}
        disabled={loading}
        onClick={() => handleDisposition(d.key)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-50
          ${isSelected
            ? "border-primary bg-primary/5 text-primary"
            : "bg-card border-border text-foreground hover:bg-muted/50"
          }`}
      >
        <span className="truncate">{d.label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Card 1: Categorização */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Headset className="w-4 h-4" />
            Categorização do Chamado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resultado do Contato */}
          {resultadoGroup.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Resultado do Contato</p>
              <div className="grid grid-cols-2 gap-2">
                {resultadoGroup.map(renderChip)}
              </div>
            </div>
          )}

          {/* Erro de Cadastro */}
          {contatoGroup.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Erro de Cadastro</p>
              <div className="space-y-1.5">
                {contatoGroup.map(d => {
                  const isSelected = selected === d.key;
                  return (
                    <button
                      key={d.key}
                      disabled={loading}
                      onClick={() => handleDisposition(d.key)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-50
                        ${isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "bg-card border-border text-foreground hover:bg-muted/50"
                        }`}
                    >
                      <span>{d.label}</span>
                      <ChevronRight className="w-4 h-4 opacity-40" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other */}
          {otherGroup.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Outros</p>
              <div className="grid grid-cols-2 gap-2">
                {otherGroup.map(renderChip)}
              </div>
            </div>
          )}

          {/* NEGOCIAR AGORA */}
          <Button
            className="w-full h-14 gap-3 text-base font-bold bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-primary-foreground"
            onClick={onNegotiate}
            disabled={loading}
          >
            <Handshake className="w-5 h-5" />
            NEGOCIAR AGORA
          </Button>
        </CardContent>
      </Card>

      {/* Card 2: Agendar Retorno */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Agendar Retorno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={callbackDate}
              onChange={(e) => setCallbackDate(e.target.value)}
              className="text-sm flex-1"
            />
            <Button
              size="icon"
              onClick={handleCallback}
              disabled={loading || !callbackDate}
              className="h-10 w-10 rounded-full shrink-0"
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DispositionPanel;
