import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { manualPaymentService, CreateManualPaymentData } from "@/services/manualPaymentService";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HandCoins } from "lucide-react";

interface ManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreementId: string;
  installmentNumber: number;
  installmentKey?: string;
  installmentLabel?: string;
  installmentValue: number;
  tenantId: string;
  profileId: string;
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: "PIX", label: "PIX" },
  { value: "Transferência", label: "Transferência" },
  { value: "Depósito", label: "Depósito" },
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "Outro", label: "Outro" },
];

const ManualPaymentDialog = ({
  open, onOpenChange, agreementId, installmentNumber, installmentKey, installmentLabel,
  installmentValue, tenantId, profileId, onSuccess,
}: ManualPaymentDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amountPaid, setAmountPaid] = useState(installmentValue);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receiver, setReceiver] = useState("");
  const [notes, setNotes] = useState("");

  const isValid = amountPaid > 0 && paymentDate && paymentMethod && receiver;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const data: CreateManualPaymentData = {
        agreement_id: agreementId,
        installment_number: installmentNumber,
        installment_key: installmentKey,
        amount_paid: amountPaid,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        receiver,
        notes: notes || undefined,
      };
      await manualPaymentService.create(data, tenantId, profileId);
      toast({ title: "Solicitação de baixa registrada", description: "Aguardando confirmação do administrador." });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Erro ao registrar baixa", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-primary" />
            Baixa Manual — {installmentLabel || (installmentNumber === 0 ? "Entrada" : `Parcela ${installmentNumber}`)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Valor Pago *</Label>
            <CurrencyInput value={amountPaid} onValueChange={setAmountPaid} />
          </div>

          <div>
            <Label className="text-xs">Data do Pagamento *</Label>
            <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Meio de Pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Recebedor *</Label>
            <Select value={receiver} onValueChange={setReceiver}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDOR">CREDOR</SelectItem>
                <SelectItem value="COBRADORA">COBRADORA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Informações adicionais..." />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!isValid || loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Solicitar Baixa Manual
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            A baixa será efetivada somente após confirmação do administrador.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualPaymentDialog;
