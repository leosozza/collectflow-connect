import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { AgreementFormData } from "@/services/agreementService";
import { useGamificationTrigger } from "@/hooks/useGamificationTrigger";

interface AgreementFormProps {
  onSubmit: (data: AgreementFormData) => Promise<void>;
}

type FormState = AgreementFormData & {
  interest_amount: number;
  penalty_amount: number;
  fees_amount: number;
  discount_amount: number;
};

const initialState = (): FormState => ({
  client_cpf: "",
  client_name: "",
  credor: "",
  original_total: 0,
  proposed_total: 0,
  discount_percent: 0,
  new_installments: 1,
  new_installment_value: 0,
  first_due_date: new Date().toISOString().split("T")[0],
  notes: "",
  interest_amount: 0,
  penalty_amount: 0,
  fees_amount: 0,
  discount_amount: 0,
});

/** Distribui um valor entre N parcelas (último arredonda diferença). */
const split = (total: number, n: number): number[] => {
  if (!n || n < 1) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const arr = Array(n).fill(base);
  const diff = Math.round((total - base * n) * 100) / 100;
  arr[n - 1] = Math.round((arr[n - 1] + diff) * 100) / 100;
  return arr;
};

/** Gera installment_breakdown distribuindo linearmente os totais entre as N parcelas. */
const buildBreakdown = (n: number, totals: { juros: number; multa: number; honorarios: number; desconto: number; principal: number }) => {
  const principalArr = split(totals.principal, n);
  const jurosArr = split(totals.juros, n);
  const multaArr = split(totals.multa, n);
  const honArr = split(totals.honorarios, n);
  const descArr = split(totals.desconto, n);
  const out: Record<string, any> = {};
  for (let i = 1; i <= n; i++) {
    out[String(i)] = {
      principal: principalArr[i - 1] || 0,
      juros: jurosArr[i - 1] || 0,
      multa: multaArr[i - 1] || 0,
      honorarios: honArr[i - 1] || 0,
      desconto: descArr[i - 1] || 0,
    };
  }
  return out;
};

const AgreementForm = ({ onSubmit }: AgreementFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { triggerGamificationUpdate } = useGamificationTrigger();
  const [form, setForm] = useState<FormState>(initialState());

  const handleOriginalChange = (original: number) => {
    const proposed = form.proposed_total || original;
    const discount = original > 0 ? ((original - proposed) / original) * 100 : 0;
    setForm({ ...form, original_total: original, discount_percent: Math.max(0, discount) });
  };

  const handleProposedChange = (proposed: number) => {
    const discount = form.original_total > 0 ? ((form.original_total - proposed) / form.original_total) * 100 : 0;
    const installmentValue = form.new_installments > 0 ? proposed / form.new_installments : proposed;
    setForm({ ...form, proposed_total: proposed, discount_percent: Math.max(0, discount), new_installment_value: installmentValue });
  };

  const handleInstallmentsChange = (n: number) => {
    const installmentValue = n > 0 ? form.proposed_total / n : form.proposed_total;
    setForm({ ...form, new_installments: n, new_installment_value: installmentValue });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Calcula principal = proposto - (juros + multa + honorários) + desconto
      const principal = Math.max(
        0,
        form.proposed_total - (form.interest_amount + form.penalty_amount + form.fees_amount) + form.discount_amount
      );
      const installment_breakdown = buildBreakdown(form.new_installments, {
        juros: form.interest_amount,
        multa: form.penalty_amount,
        honorarios: form.fees_amount,
        desconto: form.discount_amount,
        principal,
      });

      const payload: AgreementFormData = {
        client_cpf: form.client_cpf,
        client_name: form.client_name,
        credor: form.credor,
        original_total: form.original_total,
        proposed_total: form.proposed_total,
        discount_percent: form.discount_percent,
        new_installments: form.new_installments,
        new_installment_value: form.new_installment_value,
        first_due_date: form.first_due_date,
        notes: form.notes,
        interest_amount: form.interest_amount,
        penalty_amount: form.penalty_amount,
        fees_amount: form.fees_amount,
        discount_amount: form.discount_amount,
        installment_breakdown,
      };

      await onSubmit(payload);
      setOpen(false);
      triggerGamificationUpdate();
      setForm(initialState());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Nova Proposta</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Proposta de Acordo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CPF</Label>
              <Input required value={form.client_cpf} onChange={e => setForm({ ...form, client_cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>Nome do Cliente</Label>
              <Input required value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Credor</Label>
            <Input required value={form.credor} onChange={e => setForm({ ...form, credor: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Original (R$)</Label>
              <CurrencyInput value={form.original_total} onValueChange={handleOriginalChange} required />
            </div>
            <div>
              <Label>Valor Proposto (R$)</Label>
              <CurrencyInput value={form.proposed_total} onValueChange={handleProposedChange} required />
            </div>
          </div>

          {/* Composição do acordo */}
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Composição do acordo
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Juros (R$)</Label>
                <CurrencyInput value={form.interest_amount} onValueChange={v => setForm({ ...form, interest_amount: v })} />
              </div>
              <div>
                <Label className="text-xs">Multa (R$)</Label>
                <CurrencyInput value={form.penalty_amount} onValueChange={v => setForm({ ...form, penalty_amount: v })} />
              </div>
              <div>
                <Label className="text-xs">Honorários (R$)</Label>
                <CurrencyInput value={form.fees_amount} onValueChange={v => setForm({ ...form, fees_amount: v })} />
              </div>
              <div>
                <Label className="text-xs">Desconto (R$)</Label>
                <CurrencyInput value={form.discount_amount} onValueChange={v => setForm({ ...form, discount_amount: v })} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Esses valores são distribuídos linearmente entre as parcelas e ficam visíveis em Baixas Realizadas.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Desconto (%)</Label>
              <Input type="number" disabled value={form.discount_percent.toFixed(1)} />
            </div>
            <div>
              <Label>Nº Parcelas</Label>
              <Input type="number" min="1" required value={form.new_installments} onChange={e => handleInstallmentsChange(Number(e.target.value))} />
            </div>
            <div>
              <Label>Valor Parcela (R$)</Label>
              <Input type="number" disabled value={form.new_installment_value.toFixed(2)} />
            </div>
          </div>
          <div>
            <Label>Primeiro Vencimento</Label>
            <Input type="date" required value={form.first_due_date} onChange={e => setForm({ ...form, first_due_date: e.target.value })} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enviando..." : "Criar Proposta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AgreementForm;
