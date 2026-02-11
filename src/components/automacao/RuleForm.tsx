import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CollectionRule } from "@/services/automacaoService";

interface RuleFormProps {
  rule?: CollectionRule | null;
  onSave: (data: { name: string; channel: string; days_offset: number; message_template: string }) => void;
  onCancel: () => void;
  saving?: boolean;
}

const TEMPLATE_VARS = ["{{nome}}", "{{cpf}}", "{{valor_parcela}}", "{{data_vencimento}}", "{{credor}}"];

const SAMPLE_DATA: Record<string, string> = {
  "{{nome}}": "João Silva",
  "{{cpf}}": "123.456.789-00",
  "{{valor_parcela}}": "R$ 350,00",
  "{{data_vencimento}}": "15/03/2026",
  "{{credor}}": "MAXFAMA",
};

const RuleForm = ({ rule, onSave, onCancel, saving }: RuleFormProps) => {
  const [name, setName] = useState(rule?.name || "");
  const [channel, setChannel] = useState<string>(rule?.channel || "whatsapp");
  const [daysOffset, setDaysOffset] = useState(rule?.days_offset?.toString() || "0");
  const [template, setTemplate] = useState(
    rule?.message_template || "Olá {{nome}}, sua parcela de {{valor_parcela}} vence em {{data_vencimento}}. Entre em contato para regularizar."
  );

  const preview = TEMPLATE_VARS.reduce(
    (text, v) => text.split(v).join(SAMPLE_DATA[v] || v),
    template
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, channel, days_offset: parseInt(daysOffset), message_template: template });
  };

  const daysLabel = () => {
    const d = parseInt(daysOffset);
    if (d < 0) return `${Math.abs(d)} dia(s) antes do vencimento`;
    if (d === 0) return "No dia do vencimento";
    return `${d} dia(s) após o vencimento`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rule ? "Editar Regra" : "Nova Regra de Cobrança"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da regra</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lembrete 3 dias antes" required />
            </div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias em relação ao vencimento</Label>
            <Input
              type="number"
              value={daysOffset}
              onChange={(e) => setDaysOffset(e.target.value)}
              min={-30}
              max={30}
            />
            <p className="text-xs text-muted-foreground">{daysLabel()}</p>
          </div>

          <div className="space-y-2">
            <Label>Template da mensagem</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {TEMPLATE_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTemplate((t) => t + " " + v)}
                  className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-3 rounded-md bg-muted text-sm whitespace-pre-wrap">{preview}</div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RuleForm;
