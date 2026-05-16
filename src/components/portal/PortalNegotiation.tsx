import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, Sparkles, Star } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";

export interface PortalTemplate {
  id: string;
  nome: string;
  tipo: "avista" | "parcelado_com_entrada" | "parcelado_sem_entrada";
  desconto_percent: number;
  parcelas: number;
  entrada_percent: number | null;
  juros_mes_percent: number | null;
  destaque: boolean;
  ordem: number;
  descricao: string | null;
}

interface NegotiationOption {
  key: string;
  template_id?: string;
  type: "avista" | "parcelado" | "proposta";
  label: string;
  discount: number;
  installments: number;
  total: number;
  installmentValue: number;
  destaque?: boolean;
  descricao?: string | null;
}

interface PortalNegotiationProps {
  credor: string;
  originalTotal: number;
  clientName: string;
  clientCpf: string;
  maxDiscount?: number;
  maxInstallments?: number;
  primaryColor?: string;
  templates?: PortalTemplate[];
  allowCustomProposal?: boolean;
  onBack: () => void;
  onSubmit: (option: { type: string; total: number; installments: number; installmentValue: number; notes: string; template_id?: string }) => void;
  submitting?: boolean;
}

const PortalNegotiation = ({
  credor, originalTotal, clientName, clientCpf,
  maxDiscount = 30, maxInstallments = 12, primaryColor,
  templates, allowCustomProposal = true,
  onBack, onSubmit, submitting,
}: PortalNegotiationProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [customInstallments, setCustomInstallments] = useState("1");
  const [notes, setNotes] = useState("");

  // Build options: use templates if provided, otherwise dynamic fallback
  const options: NegotiationOption[] = [];

  if (templates && templates.length > 0) {
    templates.forEach((t) => {
      const total = originalTotal * (1 - Number(t.desconto_percent) / 100);
      const parcelas = Math.max(1, t.parcelas);
      options.push({
        key: `tpl-${t.id}`,
        template_id: t.id,
        type: parcelas === 1 ? "avista" : "parcelado",
        label: t.nome,
        discount: Number(t.desconto_percent),
        installments: parcelas,
        total,
        installmentValue: total / parcelas,
        destaque: t.destaque,
        descricao: t.descricao,
      });
    });
  } else {
    // Fallback: dynamic generation (legacy behavior)
    options.push({
      key: "avista-1",
      type: "avista",
      label: "À vista",
      discount: maxDiscount,
      installments: 1,
      total: originalTotal * (1 - maxDiscount / 100),
      installmentValue: originalTotal * (1 - maxDiscount / 100),
    });
    [3, 6, 12].filter((n) => n <= maxInstallments).forEach((n) => {
      const disc = Math.max(maxDiscount - n * 2, 0);
      const total = originalTotal * (1 - disc / 100);
      options.push({
        key: `parcelado-${n}`,
        type: "parcelado",
        label: `${n}x`,
        discount: disc,
        installments: n,
        total,
        installmentValue: total / n,
      });
    });
  }

  const handleSubmit = () => {
    if (selected === "proposta") {
      const val = parseFloat(customValue) || 0;
      const inst = parseInt(customInstallments) || 1;
      if (val <= 0) return;
      onSubmit({ type: "proposta", total: val, installments: inst, installmentValue: val / inst, notes });
    } else {
      const opt = options.find((o) => o.key === selected);
      if (!opt) return;
      onSubmit({
        type: opt.type,
        total: opt.total,
        installments: opt.installments,
        installmentValue: opt.installmentValue,
        notes,
        template_id: opt.template_id,
      });
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
        <h2 className="text-2xl font-bold text-foreground">Escolha sua negociação</h2>
        <p className="text-muted-foreground">{credor} • Valor original: {formatCurrency(originalTotal)}</p>
      </motion.div>

      <div className="grid gap-3">
        {options.map((opt, idx) => {
          const isSelected = selected === opt.key;
          return (
            <motion.div
              key={opt.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              <Card
                className={`cursor-pointer transition-all border-0 shadow-sm rounded-xl ${isSelected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md"}`}
                onClick={() => setSelected(opt.key)}
              >
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{opt.label}</p>
                        {opt.destaque && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                            <Star className="w-2.5 h-2.5" /> Mais escolhido
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {opt.installments > 1 ? `${opt.installments}x de ${formatCurrency(opt.installmentValue)}` : formatCurrency(opt.total)}
                      </p>
                      {opt.descricao && <p className="text-xs text-muted-foreground mt-0.5">{opt.descricao}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
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

        {allowCustomProposal && (
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
        )}
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
          <Button className="w-full text-white" size="lg" disabled={submitting} onClick={handleSubmit} style={primaryColor ? { backgroundColor: primaryColor } : undefined}>
            {submitting ? "Enviando..." : "Confirmar"}
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
