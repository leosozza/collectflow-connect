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
        <CardTitle className="text-base">Ações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AGENDAR */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agendar</p>
          <Button
            disabled={loading}
            onClick={() => setShowCallback(!showCallback)}
            className="w-full h-12 justify-start gap-3 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white"
          >
            <PhoneForwarded className="w-5 h-5 flex-shrink-0" />
            Retornar Ligação
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

        {/* RESULTADO DA LIGAÇÃO */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resultado da Ligação</p>
          <div className="grid grid-cols-1 gap-2">
            <Button
              disabled={loading}
              onClick={() => handleDisposition("voicemail")}
              className="w-full h-12 justify-start gap-3 text-sm font-medium bg-red-500 hover:bg-red-600 text-white"
            >
              <Voicemail className="w-5 h-5 flex-shrink-0" />
              Caixa Postal
            </Button>
            <Button
              disabled={loading}
              onClick={() => handleDisposition("interrupted")}
              className="w-full h-12 justify-start gap-3 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              <PhoneOff className="w-5 h-5 flex-shrink-0" />
              Ligação Interrompida
            </Button>
            <Button
              disabled={loading}
              onClick={() => handleDisposition("no_answer")}
              className="w-full h-12 justify-start gap-3 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white"
            >
              <PhoneOff className="w-5 h-5 flex-shrink-0" />
              Não Atende
            </Button>
          </div>
        </div>

        {/* CONTATO */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
          <div className="grid grid-cols-1 gap-2">
            <Button
              disabled={loading}
              onClick={() => handleDisposition("wrong_contact")}
              className="w-full h-12 justify-start gap-3 text-sm font-medium bg-gray-500 hover:bg-gray-600 text-white"
            >
              <UserX className="w-5 h-5 flex-shrink-0" />
              Contato Incorreto
            </Button>
            <Button
              disabled={loading}
              onClick={() => handleDisposition("promise")}
              className="w-full h-12 justify-start gap-3 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Clock className="w-5 h-5 flex-shrink-0" />
              Promessa de Pagamento
            </Button>
          </div>
        </div>

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
