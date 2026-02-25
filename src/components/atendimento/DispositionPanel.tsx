import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Voicemail, PhoneOff, UserX, PhoneForwarded, Handshake, Clock 
} from "lucide-react";
import { DispositionType, DISPOSITION_TYPES, getDispositionTypes, getCustomDispositionList } from "@/services/dispositionService";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface DispositionPanelProps {
  onDisposition: (type: DispositionType, notes?: string, scheduledCallback?: string) => Promise<void>;
  onNegotiate: () => void;
  loading?: boolean;
}

const DEFAULT_ICON_MAP: Record<string, React.ReactNode> = {
  voicemail: <Voicemail className="w-5 h-5 flex-shrink-0" />,
  interrupted: <PhoneOff className="w-5 h-5 flex-shrink-0" />,
  wrong_contact: <UserX className="w-5 h-5 flex-shrink-0" />,
  callback: <PhoneForwarded className="w-5 h-5 flex-shrink-0" />,
  no_answer: <PhoneOff className="w-5 h-5 flex-shrink-0" />,
  promise: <Clock className="w-5 h-5 flex-shrink-0" />,
  negotiated: <Handshake className="w-5 h-5 flex-shrink-0" />,
};

const DEFAULT_COLOR_MAP: Record<string, string> = {
  voicemail: "bg-red-500 hover:bg-red-600",
  interrupted: "bg-amber-500 hover:bg-amber-600",
  wrong_contact: "bg-gray-500 hover:bg-gray-600",
  callback: "bg-blue-500 hover:bg-blue-600",
  no_answer: "bg-orange-500 hover:bg-orange-600",
  promise: "bg-emerald-500 hover:bg-emerald-600",
  negotiated: "bg-green-600 hover:bg-green-700",
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
    if (!callbackDate) {
      toast.error("Informe a data/hora do retorno");
      return;
    }
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

  // Group dispositions
  const agendarGroup = dispositionList.filter(d => (d.group || DEFAULT_GROUP_MAP[d.key]) === "agendar");
  const resultadoGroup = dispositionList.filter(d => (d.group || DEFAULT_GROUP_MAP[d.key]) === "resultado");
  const contatoGroup = dispositionList.filter(d => (d.group || DEFAULT_GROUP_MAP[d.key]) === "contato");
  const otherGroup = dispositionList.filter(d => {
    const g = d.group || DEFAULT_GROUP_MAP[d.key];
    return !g || !["agendar", "resultado", "contato"].includes(g);
  });

  const renderButton = (d: { key: string; label: string; color?: string }) => {
    const colorClass = d.color || DEFAULT_COLOR_MAP[d.key] || "bg-primary hover:bg-primary/90";
    const icon = DEFAULT_ICON_MAP[d.key] || <PhoneOff className="w-5 h-5 flex-shrink-0" />;

    if (d.key === "callback") {
      return (
        <div key={d.key} className="space-y-2">
          <Button
            disabled={loading}
            onClick={() => setShowCallback(!showCallback)}
            className={`w-full h-12 justify-start gap-3 text-sm font-medium text-white ${colorClass}`}
          >
            {icon}
            {d.label}
          </Button>
          {showCallback && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <label className="text-xs font-medium text-muted-foreground">Data/Hora do Retorno</label>
              <Input
                type="datetime-local"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
              />
              <Button size="sm" onClick={handleCallback} disabled={loading}>
                Agendar Retorno
              </Button>
            </div>
          )}
        </div>
      );
    }

    return (
      <Button
        key={d.key}
        disabled={loading}
        onClick={() => handleDisposition(d.key)}
        className={`w-full h-12 justify-start gap-3 text-sm font-medium text-white ${colorClass}`}
      >
        {icon}
        {d.label}
      </Button>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AGENDAR */}
        {agendarGroup.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agendar</p>
            {agendarGroup.map(renderButton)}
          </div>
        )}

        {/* RESULTADO DA LIGAÇÃO */}
        {resultadoGroup.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado da Ligação</p>
            <div className="grid grid-cols-1 gap-2">
              {resultadoGroup.map(renderButton)}
            </div>
          </div>
        )}

        {/* CONTATO */}
        {contatoGroup.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
            <div className="grid grid-cols-1 gap-2">
              {contatoGroup.map(renderButton)}
            </div>
          </div>
        )}

        {/* OTHER */}
        {otherGroup.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outros</p>
            <div className="grid grid-cols-1 gap-2">
              {otherGroup.map(renderButton)}
            </div>
          </div>
        )}

        {/* OBSERVAÇÕES */}
        <Textarea
          placeholder="Observações..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />

        {/* NEGOCIAÇÃO */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negociação</p>
          <Button
            className="w-full h-14 gap-3 text-base font-semibold bg-green-600 hover:bg-green-700 text-white"
            onClick={onNegotiate}
            disabled={loading}
          >
            <Handshake className="w-5 h-5" />
            Negociar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DispositionPanel;
