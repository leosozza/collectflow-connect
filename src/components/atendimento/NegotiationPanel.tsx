import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { X } from "lucide-react";

interface NegotiationTemplate {
  label: string;
  discountPercent: number;
  installments: number;
}

const templates: NegotiationTemplate[] = [
  { label: "À vista com 30% desconto", discountPercent: 30, installments: 1 },
  { label: "2x com 20% desconto", discountPercent: 20, installments: 2 },
  { label: "3x com 15% desconto", discountPercent: 15, installments: 3 },
  { label: "6x com 10% desconto", discountPercent: 10, installments: 6 },
  { label: "12x sem desconto", discountPercent: 0, installments: 12 },
];

interface NegotiationPanelProps {
  totalAberto: number;
  clientCpf: string;
  clientName: string;
  credor: string;
  onClose: () => void;
  onCreateAgreement: (data: {
    discount_percent: number;
    new_installments: number;
    proposed_total: number;
    new_installment_value: number;
    first_due_date: string;
    notes?: string;
  }) => Promise<void>;
  loading?: boolean;
}

const NegotiationPanel = ({
  totalAberto,
  onClose,
  onCreateAgreement,
  loading,
}: NegotiationPanelProps) => {
  const [discountPercent, setDiscountPercent] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const proposedTotal = totalAberto * (1 - discountPercent / 100);
  const installmentValue = installments > 0 ? proposedTotal / installments : 0;

  const applyTemplate = (t: NegotiationTemplate) => {
    setDiscountPercent(t.discountPercent);
    setInstallments(t.installments);
  };

  const handleSubmit = async () => {
    await onCreateAgreement({
      discount_percent: discountPercent,
      new_installments: installments,
      proposed_total: proposedTotal,
      new_installment_value: installmentValue,
      first_due_date: firstDueDate,
      notes: notes || undefined,
    });
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Negociação</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Templates */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Templates</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <Button
                key={t.label}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => applyTemplate(t)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Manual simulator */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Desconto (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Parcelas</label>
            <Input
              type="number"
              min={1}
              max={60}
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">1º Vencimento</label>
            <Input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor Original</span>
            <span className="font-medium">{formatCurrency(totalAberto)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor Proposto</span>
            <span className="font-bold text-primary">{formatCurrency(proposedTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor Parcela</span>
            <span className="font-medium">{formatCurrency(installmentValue)}</span>
          </div>
        </div>

        <Textarea
          placeholder="Observações da negociação..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />

        <Button className="w-full" onClick={handleSubmit} disabled={loading}>
          Gerar Acordo
        </Button>
      </CardContent>
    </Card>
  );
};

export default NegotiationPanel;
