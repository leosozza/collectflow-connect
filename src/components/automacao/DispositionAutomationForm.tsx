import { useState } from "react";
import { DISPOSITION_TYPES, type DispositionType } from "@/services/dispositionService";
import {
  AUTOMATION_ACTION_TYPES,
  type AutomationActionType,
  type DispositionAutomation,
} from "@/services/dispositionAutomationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface DispositionAutomationFormProps {
  automation?: DispositionAutomation | null;
  onSave: (data: {
    disposition_type: string;
    action_type: string;
    action_config: Record<string, any>;
  }) => void;
  onCancel: () => void;
  saving: boolean;
}

const DispositionAutomationForm = ({
  automation,
  onSave,
  onCancel,
  saving,
}: DispositionAutomationFormProps) => {
  const [dispositionType, setDispositionType] = useState(automation?.disposition_type || "");
  const [actionType, setActionType] = useState(automation?.action_type || "");
  const [template, setTemplate] = useState(automation?.action_config?.template || "");
  const [delayHours, setDelayHours] = useState(automation?.action_config?.delay_hours || 24);
  const [reminderMessage, setReminderMessage] = useState(
    automation?.action_config?.message || "Lembrete: retornar contato com {{nome}}"
  );
  const [paymentType, setPaymentType] = useState(automation?.action_config?.tipo || "pix");

  const handleSubmit = () => {
    if (!dispositionType || !actionType) return;

    let action_config: Record<string, any> = {};
    switch (actionType) {
      case "send_whatsapp":
        action_config = { template };
        break;
      case "schedule_reminder":
        action_config = { delay_hours: delayHours, message: reminderMessage };
        break;
      case "send_payment_link":
        action_config = { tipo: paymentType };
        break;
    }

    onSave({ disposition_type: dispositionType, action_type: actionType, action_config });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {automation ? "Editar Automação" : "Nova Automação"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Tabulação</Label>
            <Select value={dispositionType} onValueChange={setDispositionType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISPOSITION_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ação</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AUTOMATION_ACTION_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {actionType === "send_whatsapp" && (
          <div className="space-y-2">
            <Label>Template da mensagem</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Olá {{nome}}, confirmamos sua negociação..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: {"{{nome}}"}, {"{{cpf}}"}, {"{{valor_parcela}}"}, {"{{data_vencimento}}"}, {"{{credor}}"}
            </p>
          </div>
        )}

        {actionType === "schedule_reminder" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Atraso (horas)</Label>
              <Input
                type="number"
                min={1}
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem do lembrete</Label>
              <Textarea
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {actionType === "send_payment_link" && (
          <div className="space-y-2">
            <Label>Tipo de cobrança</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saving || !dispositionType || !actionType}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {automation ? "Salvar" : "Criar"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DispositionAutomationForm;
