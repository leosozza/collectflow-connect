import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Headset, ChevronRight, CalendarClock, Check
} from "lucide-react";
import { DispositionType, DISPOSITION_TYPES, fetchTenantDispositionTypes } from "@/services/dispositionService";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface DispositionPanelProps {
  onDisposition: (type: DispositionType, notes?: string, scheduledCallback?: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

const DEFAULT_GROUP_MAP: Record<string, string> = {
  voicemail: "resultado",
  interrupted: "resultado",
  no_answer: "resultado",
  cpc: "resultado",
  wrong_contact: "contato",
};

const DispositionPanel = ({ onDisposition, loading }: DispositionPanelProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [selected, setSelected] = useState<string | null>(null);
  const [callbackDate, setCallbackDate] = useState("");

  const { data: dbTypes } = useQuery({
    queryKey: ["call-disposition-types", tenantId],
    queryFn: () => fetchTenantDispositionTypes(tenantId!),
    enabled: !!tenantId,
  });

  const dispositionList = useMemo(() => {
    if (dbTypes && dbTypes.length > 0) {
      return dbTypes.map(d => ({ key: d.key, label: d.label, group: d.group_name }));
    }
    return Object.entries(DISPOSITION_TYPES).map(([key, label]) => ({
      key,
      label,
      group: DEFAULT_GROUP_MAP[key] || "resultado",
    }));
  }, [dbTypes]);

  const dispositionTypes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of dispositionList) map[d.key] = d.label;
    return map;
  }, [dispositionList]);

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

  const resultadoGroup = dispositionList.filter(d => d.group === "resultado");
  const contatoGroup = dispositionList.filter(d => d.group === "contato");
  const otherGroup = dispositionList.filter(d => !d.group || !["agendar", "resultado", "contato"].includes(d.group));

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
      {/* Card 1: Agendar Retorno */}
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

      {/* Card 2: Categorização */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Headset className="w-4 h-4" />
            Resultado do Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resultadoGroup.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Resultado do Contato</p>
              <div className="grid grid-cols-2 gap-2">
                {resultadoGroup.map(renderChip)}
              </div>
            </div>
          )}

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

          {otherGroup.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Outros</p>
              <div className="grid grid-cols-2 gap-2">
                {otherGroup.map(renderChip)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DispositionPanel;
