import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Voicemail, PhoneOff, UserX, PhoneForwarded, Handshake, Clock, ChevronRight
} from "lucide-react";
import { DispositionType, getDispositionTypes, getCustomDispositionList } from "@/services/dispositionService";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface DispositionPanelProps {
  onDisposition: (type: DispositionType, notes?: string, scheduledCallback?: string) => Promise<void>;
  onNegotiate: () => void;
  loading?: boolean;
}

const DEFAULT_ICON_MAP: Record<string, React.ReactNode> = {
  voicemail: <Voicemail className="w-4 h-4 flex-shrink-0" />,
  interrupted: <PhoneOff className="w-4 h-4 flex-shrink-0" />,
  wrong_contact: <UserX className="w-4 h-4 flex-shrink-0" />,
  callback: <PhoneForwarded className="w-4 h-4 flex-shrink-0" />,
  no_answer: <PhoneOff className="w-4 h-4 flex-shrink-0" />,
  promise: <Clock className="w-4 h-4 flex-shrink-0" />,
  negotiated: <Handshake className="w-4 h-4 flex-shrink-0" />,
};

const DEFAULT_COLOR_MAP: Record<string, string> = {
  voicemail: "bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20",
  interrupted: "bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20",
  wrong_contact: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
  callback: "bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20",
  no_answer: "bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20",
  promise: "bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20",
  negotiated: "bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20",
};

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
  const [showCallback, setShowCallback] = useState(false);
  const [callbackDate, setCallbackDate] = useState("");
  const [notes, setNotes] = useState("");

  const dispositionTypes = useMemo(() => getDispositionTypes(settings), [settings]);
  const dispositionList = useMemo(() => getCustomDispositionList(settings), [settings]);

  const handleDisposition = async (type: string) => {
    try {
      await onDisposition(type, notes || undefined);
      setNotes("");
      toast.success(`Tabulação "${dispositionTypes[type] || type}" registrada`);
    } catch {
      toast.error("Erro ao registrar tabulação");
    }
  };

  const handleCallback = async () => {
    if (!callbackDate) { toast.error("Informe a data/hora do retorno"); return; }
    try {
      await onDisposition("callback", notes || undefined, callbackDate);
      setCallbackDate("");
      setNotes("");
      setShowCallback(false);
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
  const agendarGroup = dispositionList.filter(d => (d.group || DEFAULT_GROUP_MAP[d.key]) === "agendar");
  const otherGroup = dispositionList.filter(d => {
    const g = d.group || DEFAULT_GROUP_MAP[d.key];
    return !g || !["agendar", "resultado", "contato"].includes(g);
  });

  const renderChip = (d: { key: string; label: string; color?: string }) => {
    const colorClass = d.color || DEFAULT_COLOR_MAP[d.key] || "bg-muted text-foreground border-border hover:bg-muted/80";
    const icon = DEFAULT_ICON_MAP[d.key] || <PhoneOff className="w-4 h-4 flex-shrink-0" />;

    if (d.key === "callback") {
      return (
        <div key={d.key} className="col-span-2 space-y-2">
          <button
            disabled={loading}
            onClick={() => setShowCallback(!showCallback)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${colorClass}`}
          >
            <span className="flex items-center gap-2">{icon}{d.label}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showCallback ? "rotate-90" : ""}`} />
          </button>
          {showCallback && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
              <label className="text-xs font-medium text-muted-foreground">Data/Hora do Retorno</label>
              <Input type="datetime-local" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)} className="text-sm" />
              <Button size="sm" onClick={handleCallback} disabled={loading} className="w-full">Agendar Retorno</Button>
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={d.key}
        disabled={loading}
        onClick={() => handleDisposition(d.key)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${colorClass}`}
      >
        {icon}
        <span className="truncate">{d.label}</span>
      </button>
    );
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Categorização da Chamada
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

        {/* Contato / Erro */}
        {contatoGroup.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Erro de Cadastro</p>
            <div className="grid grid-cols-1 gap-2">
              {contatoGroup.map(d => {
                const colorClass = d.color || DEFAULT_COLOR_MAP[d.key] || "bg-muted text-foreground border-border hover:bg-muted/80";
                const icon = DEFAULT_ICON_MAP[d.key] || <UserX className="w-4 h-4" />;
                return (
                  <button
                    key={d.key}
                    disabled={loading}
                    onClick={() => handleDisposition(d.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${colorClass}`}
                  >
                    <span className="flex items-center gap-2">{icon}{d.label}</span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Other dispositions */}
        {otherGroup.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Outros</p>
            <div className="grid grid-cols-2 gap-2">
              {otherGroup.map(renderChip)}
            </div>
          </div>
        )}

        {/* NEGOCIAR AGORA — destaque */}
        <Button
          className="w-full h-14 gap-3 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={onNegotiate}
          disabled={loading}
        >
          <Handshake className="w-5 h-5" />
          NEGOCIAR AGORA
        </Button>

        {/* Agendar Retorno */}
        {agendarGroup.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Agendar</p>
            {agendarGroup.map(renderChip)}
          </div>
        )}

        {/* Observações */}
        <Textarea
          placeholder="Observações do atendimento..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />
      </CardContent>
    </Card>
  );
};

export default DispositionPanel;
