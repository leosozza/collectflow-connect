import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { manualPaymentService, CreateManualPaymentData, ManualPayment } from "@/services/manualPaymentService";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HandCoins, AlertTriangle } from "lucide-react";

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

const formatBR = (n: number) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [existing, setExisting] = useState<ManualPayment | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // On open, check for existing confirmed/pending payment for this installment
  useEffect(() => {
    if (!open) return;
    setAmountPaid(installmentValue);
    setExisting(null);
    setCheckingExisting(true);
    manualPaymentService
      .findExistingActivePayment(agreementId, installmentKey ?? null, installmentNumber)
      .then((row) => setExisting(row))
      .catch(() => setExisting(null))
      .finally(() => setCheckingExisting(false));
  }, [open, agreementId, installmentKey, installmentNumber, installmentValue]);

  const isBlocked = !!existing;
  const isValid = !isBlocked && amountPaid > 0 && paymentDate && paymentMethod && receiver;

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

        {checkingExisting ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mx-auto animate-spin mb-2" />
            Verificando baixas existentes...
          </div>
        ) : isBlocked ? (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-destructive">Esta parcela já tem uma baixa registrada</p>
                  <p className="text-xs text-muted-foreground">
                    {existing!.status === "confirmed" ? "Baixa confirmada" : "Aguardando confirmação"} de{" "}
                    <strong>{formatBR(existing!.amount_paid)}</strong>{" "}
                    em <strong>{new Date((existing!.payment_date || existing!.created_at) + (existing!.payment_date ? "T00:00:00" : "")).toLocaleDateString("pt-BR")}</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Para alterar o valor, peça ao administrador para editar a baixa existente
                    (ícone de lápis na aba <em>"Confirmação de Pagamento"</em>).
                  </p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Valor Pago *</Label>
              <CurrencyInput value={amountPaid} onValueChange={setAmountPaid} />
              {Math.abs(amountPaid - installmentValue) > 0.01 && (
                <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  Valor pago difere do valor da parcela em <strong>{formatBR(Math.abs(amountPaid - installmentValue))}</strong>.
                  Ao confirmar, o valor da parcela será atualizado para refletir o valor recebido.
                </p>
              )}
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManualPaymentDialog;
