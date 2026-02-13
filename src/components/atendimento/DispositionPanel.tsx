import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Voicemail, PhoneOff, UserX, PhoneForwarded, Handshake, Clock 
} from "lucide-react";
import { DispositionType, DISPOSITION_TYPES } from "@/services/dispositionService";
import { toast } from "sonner";

interface DispositionPanelProps {
  onDisposition: (type: DispositionType, notes?: string, scheduledCallback?: string) => Promise<void>;
  onNegotiate: () => void;
  loading?: boolean;
}

const dispositionButtons: { type: DispositionType; icon: any; variant: "outline" | "default" | "destructive" }[] = [
  { type: "voicemail", icon: Voicemail, variant: "outline" },
  { type: "interrupted", icon: PhoneOff, variant: "outline" },
  { type: "wrong_contact", icon: UserX, variant: "outline" },
  { type: "no_answer", icon: PhoneOff, variant: "outline" },
  { type: "promise", icon: Clock, variant: "outline" },
];

const DispositionPanel = ({ onDisposition, onNegotiate, loading }: DispositionPanelProps) => {
  const [showCallback, setShowCallback] = useState(false);
  const [callbackDate, setCallbackDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleDisposition = async (type: DispositionType) => {
    try {
      await onDisposition(type, notes || undefined);
      setNotes("");
      toast.success(`Tabulação "${DISPOSITION_TYPES[type]}" registrada`);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tabulação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {dispositionButtons.map(({ type, icon: Icon, variant }) => (
            <Button
              key={type}
              variant={variant}
              size="sm"
              disabled={loading}
              onClick={() => handleDisposition(type)}
              className="justify-start gap-2 text-xs"
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {DISPOSITION_TYPES[type]}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => setShowCallback(!showCallback)}
            className="justify-start gap-2 text-xs"
          >
            <PhoneForwarded className="w-4 h-4 flex-shrink-0" />
            Retornar Ligação
          </Button>
        </div>

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

        <Textarea
          placeholder="Observações..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />

        <Button
          className="w-full gap-2"
          onClick={onNegotiate}
          disabled={loading}
        >
          <Handshake className="w-4 h-4" />
          Negociar
        </Button>
      </CardContent>
    </Card>
  );
};

export default DispositionPanel;
