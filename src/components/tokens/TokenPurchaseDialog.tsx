import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Coins, CreditCard, QrCode, FileText, ArrowRight, ArrowLeft, Check } from "lucide-react";
import TokenPackageCard from "./TokenPackageCard";
import type { TokenPackage, PaymentMethod } from "@/types/tokens";

interface TokenPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: TokenPackage[];
  tenantId: string;
  onPurchaseComplete: () => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "pix", label: "PIX", icon: <QrCode className="w-5 h-5" />, description: "Aprovação instantânea" },
  { value: "credit_card", label: "Cartão de Crédito", icon: <CreditCard className="w-5 h-5" />, description: "Parcelamento disponível" },
  { value: "boleto", label: "Boleto Bancário", icon: <FileText className="w-5 h-5" />, description: "Vencimento em 3 dias úteis" },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const TokenPurchaseDialog = ({ open, onOpenChange, packages, tenantId, onPurchaseComplete }: TokenPurchaseDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [processing, setProcessing] = useState(false);

  const handleReset = () => {
    setStep(1);
    setSelectedPackage(null);
    setPaymentMethod("pix");
    setProcessing(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) handleReset();
    onOpenChange(val);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedPackage) return;
    setProcessing(true);
    try {
      // Placeholder: In production, this would call the purchase-tokens edge function
      toast({
        title: "Compra registrada!",
        description: `${selectedPackage.token_amount + selectedPackage.bonus_tokens} tokens serão creditados após confirmação do pagamento.`,
      });
      setStep(4);
      onPurchaseComplete();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            Comprar Tokens
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Escolha um pacote de tokens"}
            {step === 2 && "Selecione a forma de pagamento"}
            {step === 3 && "Confirme sua compra"}
            {step === 4 && "Compra realizada com sucesso"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                s === step ? "bg-primary text-primary-foreground" :
                s < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && <div className={`w-8 h-0.5 ${s < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Package */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {packages.map((pkg) => (
                <TokenPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  selected={selectedPackage?.id === pkg.id}
                  onSelect={setSelectedPackage}
                />
              ))}
            </div>
            <div className="flex justify-end">
              <Button disabled={!selectedPackage} onClick={() => setStep(2)}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === 2 && (
          <div className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              {PAYMENT_METHODS.map((pm) => (
                <div
                  key={pm.value}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === pm.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                  }`}
                  onClick={() => setPaymentMethod(pm.value)}
                >
                  <RadioGroupItem value={pm.value} id={pm.value} />
                  <div className="text-primary">{pm.icon}</div>
                  <div>
                    <Label htmlFor={pm.value} className="cursor-pointer font-medium">{pm.label}</Label>
                    <p className="text-xs text-muted-foreground">{pm.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setStep(3)}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && selectedPackage && (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacote</span>
                <span className="font-medium">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tokens</span>
                <span className="font-medium">{selectedPackage.token_amount.toLocaleString("pt-BR")}</span>
              </div>
              {selectedPackage.bonus_tokens > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bônus</span>
                  <span className="font-medium text-green-600">+{selectedPackage.bonus_tokens.toLocaleString("pt-BR")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagamento</span>
                <span className="font-medium">{PAYMENT_METHODS.find(p => p.value === paymentMethod)?.label}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">{formatCurrency(selectedPackage.price)}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button onClick={handleConfirmPurchase} disabled={processing}>
                {processing ? "Processando..." : "Finalizar Compra"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center space-y-4 py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Compra Realizada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Seus tokens serão creditados após a confirmação do pagamento.
              </p>
            </div>
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TokenPurchaseDialog;
