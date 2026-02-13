import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";

interface NegotiationOption {
  type: "avista" | "parcelado" | "proposta";
  label: string;
  discount: number;
  installments: number;
  total: number;
  installmentValue: number;
}

interface PortalNegotiationProps {
  credor: string;
  originalTotal: number;
  clientName: string;
  clientCpf: string;
  maxDiscount?: number;
  maxInstallments?: number;
  onBack: () => void;
  onSubmit: (option: { type: string; total: number; installments: number; installmentValue: number; notes: string }) => void;
  submitting?: boolean;
}

const PortalNegotiation = ({
  credor, originalTotal, clientName, clientCpf,
  maxDiscount = 30, maxInstallments = 12,
  onBack, onSubmit, submitting,
}: PortalNegotiationProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [customInstallments, setCustomInstallments] = useState("1");
  const [notes, setNotes] = useState("");

  const options: NegotiationOption[] = [
    {
      type: "avista",
      label: "À vista",
      discount: maxDiscount,
      installments: 1,
      total: originalTotal * (1 - maxDiscount / 100),
      installmentValue: originalTotal * (1 - maxDiscount / 100),
    },
  ];

  const installmentCounts = [3, 6, 12].filter((n) => n <= maxInstallments);
  installmentCounts.forEach((n) => {
    const disc = Math.max(maxDiscount - n * 2, 0);
    const total = originalTotal * (1 - disc / 100);
    options.push({
      type: "parcelado",
      label: `${n}x`,
      discount: disc,
      installments: n,
      total,
      installmentValue: total / n,
    });
  });

  const handleSubmit = () => {
    if (selected === "proposta") {
      const val = parseFloat(customValue) || 0;
      const inst = parseInt(customInstallments) || 1;
      if (val <= 0) return;
      onSubmit({ type: "proposta", total: val, installments: inst, installmentValue: val / inst, notes });
    } else {
      const opt = options.find((o) => `${o.type}-${o.installments}` === selected);
      if (!opt) return;
      onSubmit({ type: opt.type, total: opt.total, installments: opt.installments, installmentValue: opt.installmentValue, notes });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-8">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold text-foreground">Simule sua negociação</h2>
        <p className="text-muted-foreground">{credor} • Valor original: {formatCurrency(originalTotal)}</p>
      </motion.div>

      {/* Options */}
      <div className="grid gap-3">
        {options.map((opt, idx) => {
          const key = `${opt.type}-${opt.installments}`;
          const isSelected = selected === key;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <Card
                className={`cursor-pointer transition-all border-0 shadow-sm rounded-xl ${isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"}`}
                onClick={() => setSelected(key)}
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{opt.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {opt.installments > 1 ? `${opt.installments}x de ${formatCurrency(opt.installmentValue)}` : formatCurrency(opt.total)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {opt.discount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Sparkles className="w-3 h-3" /> {opt.discount}% off
                      </span>
                    )}
                    <p className="text-sm font-semibold text-foreground mt-1">{formatCurrency(opt.total)}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Free proposal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: options.length * 0.05 }}
        >
          <Card
            className={`cursor-pointer transition-all border-0 shadow-sm rounded-xl ${selected === "proposta" ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"}`}
            onClick={() => setSelected("proposta")}
          >
            <CardContent className="py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected === "proposta" ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                  {selected === "proposta" && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>
                <p className="font-semibold text-foreground">Fazer minha proposta</p>
              </div>
              {selected === "proposta" && (
                <div className="grid grid-cols-2 gap-3 ml-8">
                  <div>
                    <Label className="text-xs">Valor total (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="0,00"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Input
                      type="number"
                      min="1"
                      max={maxInstallments}
                      value={customInstallments}
                      onChange={(e) => setCustomInstallments(e.target.value)}
                    />
                  </div>
                  {parseFloat(customValue) > 0 && parseInt(customInstallments) > 1 && (
                    <p className="col-span-2 text-sm text-muted-foreground">
                      {customInstallments}x de {formatCurrency(parseFloat(customValue) / parseInt(customInstallments))}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {selected && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <Label>Observações (opcional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observação sobre sua proposta..."
            />
          </div>
          <Button className="w-full text-white" size="lg" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Enviando..." : "Enviar Proposta"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Sua proposta será analisada pela empresa. Você receberá o link de pagamento após aprovação.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default PortalNegotiation;
