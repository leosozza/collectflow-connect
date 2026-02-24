import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { AgreementFormData } from "@/services/agreementService";
import { formatCPF } from "@/lib/formatters";

interface AgreementFormProps {
  onSubmit: (data: AgreementFormData) => Promise<void>;
}

const AgreementForm = ({ onSubmit }: AgreementFormProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<AgreementFormData>({
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
  });

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
      await onSubmit(form);
      setOpen(false);
      setForm({
        client_cpf: "", client_name: "", credor: "", original_total: 0,
        proposed_total: 0, discount_percent: 0, new_installments: 1,
        new_installment_value: 0, first_due_date: new Date().toISOString().split("T")[0], notes: "",
      });
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
