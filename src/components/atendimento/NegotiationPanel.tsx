import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters";
import { X, AlertTriangle } from "lucide-react";

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

interface CredorRules {
  desconto_maximo: number;
  parcelas_max: number;
  entrada_minima_valor: number;
  entrada_minima_tipo: string;
}

interface NegotiationPanelProps {
  totalAberto: number;
  clientCpf: string;
  clientName: string;
  credor: string;
  credorRules?: CredorRules | null;
  onClose: () => void;
  onCreateAgreement: (data: {
    discount_percent: number;
    new_installments: number;
    proposed_total: number;
    new_installment_value: number;
    first_due_date: string;
    notes?: string;
    requiresApproval?: boolean;
    approvalReason?: string;
  }) => Promise<void>;
  loading?: boolean;
}

const NegotiationPanel = ({
  totalAberto,
  credorRules,
  onClose,
  onCreateAgreement,
  loading,
}: NegotiationPanelProps) => {
  const [discountPercent, setDiscountPercent] = useState<number | "">(0);
  const [installments, setInstallments] = useState<number | "">(1);
  const [firstDueDate, setFirstDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const numDiscount = typeof discountPercent === "number" ? discountPercent : 0;
  const numInstallments = typeof installments === "number" && installments > 0 ? installments : 1;
  const proposedTotal = totalAberto * (1 - numDiscount / 100);
  const installmentValue = proposedTotal / numInstallments;

  const applyTemplate = (t: NegotiationTemplate) => {
    setDiscountPercent(t.discountPercent);
    setInstallments(t.installments);
  };

  // Detect if out of standard — if no credorRules found, require approval
  const outOfStandard = useMemo(() => {
    if (!credorRules) {
      // No rules configured = always require approval when there's a discount or multiple installments
      if (numDiscount > 0 || numInstallments > 1) {
        return { isOut: true, reasons: ["Credor sem regras de negociação cadastradas — requer liberação"] };
      }
      return { isOut: false, reasons: [] as string[] };
    }
    const reasons: string[] = [];
    if (credorRules.desconto_maximo > 0 && numDiscount > credorRules.desconto_maximo) {
      reasons.push(`Desconto ${numDiscount}% excede máx ${credorRules.desconto_maximo}%`);
    }
    if (credorRules.parcelas_max > 0 && numInstallments > credorRules.parcelas_max) {
      reasons.push(`Parcelas ${numInstallments}x excede máx ${credorRules.parcelas_max}x`);
    }
    return { isOut: reasons.length > 0, reasons };
  }, [credorRules, numDiscount, numInstallments]);

  const handleSubmit = async () => {
    await onCreateAgreement({
      discount_percent: numDiscount,
      new_installments: numInstallments,
      proposed_total: proposedTotal,
      new_installment_value: installmentValue,
      first_due_date: firstDueDate,
      notes: notes || undefined,
      requiresApproval: outOfStandard.isOut,
      approvalReason: outOfStandard.isOut ? outOfStandard.reasons.join("; ") : undefined,
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
              onChange={(e) => {
                const v = e.target.value;
                setDiscountPercent(v === "" ? "" : Number(v));
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Parcelas</label>
            <Input
              type="number"
              min={1}
              max={60}
              value={installments}
              onChange={(e) => {
                const v = e.target.value;
                setInstallments(v === "" ? "" : Number(v));
              }}
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

        {outOfStandard.isOut && (
          <Alert variant="destructive" className="border-orange-300 bg-orange-50 text-orange-800">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              <strong>Fora do padrão:</strong> {outOfStandard.reasons.join("; ")}
            </AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={loading}
          variant={outOfStandard.isOut ? "outline" : "default"}
        >
          {outOfStandard.isOut ? (
            <>
              <AlertTriangle className="w-4 h-4 mr-1" />
              Solicitar Liberação
            </>
          ) : (
            "Gerar Acordo"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default NegotiationPanel;
