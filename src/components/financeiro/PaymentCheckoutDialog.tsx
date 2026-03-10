import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, QrCode, FileText, ArrowLeft, ArrowRight, Loader2, Copy, Check } from "lucide-react";
import { createAsaasCustomer, createAsaasPayment, getAsaasPixQrCode } from "@/services/asaasService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  description: string;
  tenantId: string;
  tenantName: string;
  tenantCnpj?: string;
  paymentType: "subscription" | "token_purchase";
  tokenPackageId?: string;
  tokensGranted?: number;
  onSuccess?: () => void;
}

type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";

const PaymentCheckoutDialog = ({
  open,
  onOpenChange,
  amount,
  description,
  tenantId,
  tenantName,
  tenantCnpj,
  paymentType,
  tokenPackageId,
  tokensGranted,
  onSuccess,
}: PaymentCheckoutDialogProps) => {
  const [step, setStep] = useState(1);
  const [billingType, setBillingType] = useState<BillingType | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Credit card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardCpf, setCardCpf] = useState("");
  const [cardEmail, setCardEmail] = useState("");
  const [cardPhone, setCardPhone] = useState("");
  const [cardPostalCode, setCardPostalCode] = useState("");

  // Result state
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixCopyPaste, setPixCopyPaste] = useState("");
  const [boletoUrl, setBoletoUrl] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const resetState = () => {
    setStep(1);
    setBillingType(null);
    setLoading(false);
    setCopied(false);
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardName("");
    setCardCpf("");
    setCardEmail("");
    setCardPhone("");
    setCardPostalCode("");
    setPixQrCode("");
    setPixCopyPaste("");
    setBoletoUrl("");
    setInvoiceUrl("");
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const getDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  };

  const handleSelectMethod = (method: BillingType) => {
    setBillingType(method);
    setStep(3);
  };

  const handleProcessPayment = async () => {
    if (!billingType) return;
    setLoading(true);

    try {
      // 1. Ensure Asaas customer exists
      const customerResult = await createAsaasCustomer({
        name: tenantName,
        cpfCnpj: cardCpf || "00000000000",
        email: cardEmail || undefined,
        phone: cardPhone || undefined,
      });

      if (customerResult.errors) {
        toast.error(customerResult.errors[0]?.description || "Erro ao criar cliente Asaas");
        setLoading(false);
        return;
      }

      const customerId = customerResult.id;

      // Save Asaas customer link
      await supabase.from("asaas_customers" as any).upsert(
        {
          tenant_id: tenantId,
          asaas_customer_id: customerId,
          name: tenantName,
          cpf_cnpj: cardCpf || "00000000000",
          email: cardEmail || null,
          phone: cardPhone || null,
        } as any,
        { onConflict: "asaas_customer_id" }
      );

      // 2. Create payment
      const paymentPayload: any = {
        customer: customerId,
        billingType,
        value: amount,
        dueDate: getDueDate(),
        description,
      };

      if (billingType === "CREDIT_CARD") {
        const [expMonth, expYear] = cardExpiry.split("/");
        paymentPayload.creditCard = {
          holderName: cardName,
          number: cardNumber.replace(/\s/g, ""),
          expiryMonth: expMonth,
          expiryYear: expYear?.length === 2 ? `20${expYear}` : expYear,
          ccv: cardCvv,
        };
        paymentPayload.creditCardHolderInfo = {
          name: cardName,
          email: cardEmail,
          cpfCnpj: cardCpf,
          phone: cardPhone,
          postalCode: cardPostalCode,
          addressNumber: "0",
        };
      }

      const paymentResult = await createAsaasPayment(paymentPayload);

      if (paymentResult.errors) {
        toast.error(paymentResult.errors[0]?.description || "Erro ao criar cobrança");
        setLoading(false);
        return;
      }

      // 3. Save payment record
      await supabase.from("payment_records").insert({
        tenant_id: tenantId,
        payment_type: paymentType,
        amount,
        status: billingType === "CREDIT_CARD" && paymentResult.status === "CONFIRMED" ? "completed" : "pending",
        payment_method: billingType.toLowerCase(),
        payment_gateway: "asaas",
        asaas_payment_id: paymentResult.id,
        billing_type: billingType,
        asaas_status: paymentResult.status,
        due_date: getDueDate(),
        invoice_url: paymentResult.invoiceUrl || null,
        token_package_id: tokenPackageId || null,
        tokens_granted: tokensGranted || null,
      } as any);

      // 4. Handle result by type
      if (billingType === "PIX") {
        const pixResult = await getAsaasPixQrCode(paymentResult.id);
        setPixQrCode(pixResult.encodedImage || "");
        setPixCopyPaste(pixResult.payload || "");
      } else if (billingType === "BOLETO") {
        setBoletoUrl(paymentResult.bankSlipUrl || "");
        setInvoiceUrl(paymentResult.invoiceUrl || "");
      }

      setStep(4);

      if (billingType === "CREDIT_CARD" && paymentResult.status === "CONFIRMED") {
        toast.success("Pagamento aprovado com sucesso!");
        onSuccess?.();
      } else {
        toast.success("Cobrança gerada com sucesso!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Resumo do Pagamento"}
            {step === 2 && "Escolha o Método de Pagamento"}
            {step === 3 && `Pagamento via ${billingType === "CREDIT_CARD" ? "Cartão" : billingType === "PIX" ? "PIX" : "Boleto"}`}
            {step === 4 && "Cobrança Gerada"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Confira os dados antes de prosseguir"}
            {step === 2 && "Selecione a forma de pagamento preferida"}
            {step === 3 && "Preencha os dados para concluir o pagamento"}
            {step === 4 && "Acompanhe o status do pagamento abaixo"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — Summary */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Descrição</span>
                  <span className="font-medium text-foreground">{description}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Empresa</span>
                  <span className="font-medium text-foreground">{tenantName}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-lg text-primary">{formatCurrency(amount)}</span>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full" onClick={() => setStep(2)}>
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2 — Method selection */}
        {step === 2 && (
          <div className="space-y-3">
            {[
              { type: "CREDIT_CARD" as BillingType, icon: CreditCard, label: "Cartão de Crédito", desc: "Aprovação imediata" },
              { type: "PIX" as BillingType, icon: QrCode, label: "PIX", desc: "QR Code ou copia e cola" },
              { type: "BOLETO" as BillingType, icon: FileText, label: "Boleto Bancário", desc: "Vencimento em 3 dias úteis" },
            ].map((m) => (
              <Card
                key={m.type}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => handleSelectMethod(m.type)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <m.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
            <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
            </Button>
          </div>
        )}

        {/* Step 3 — Payment form */}
        {step === 3 && (
          <div className="space-y-4">
            {billingType === "CREDIT_CARD" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Número do cartão</Label>
                  <Input placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Validade</Label>
                    <Input placeholder="MM/AA" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CVV</Label>
                    <Input placeholder="123" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome no cartão</Label>
                  <Input placeholder="Nome completo" value={cardName} onChange={(e) => setCardName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF/CNPJ</Label>
                    <Input placeholder="000.000.000-00" value={cardCpf} onChange={(e) => setCardCpf(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail</Label>
                    <Input placeholder="email@email.com" value={cardEmail} onChange={(e) => setCardEmail(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input placeholder="(00) 00000-0000" value={cardPhone} onChange={(e) => setCardPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CEP</Label>
                    <Input placeholder="00000-000" value={cardPostalCode} onChange={(e) => setCardPostalCode(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {(billingType === "PIX" || billingType === "BOLETO") && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">CPF/CNPJ do pagador</Label>
                  <Input placeholder="000.000.000-00" value={cardCpf} onChange={(e) => setCardCpf(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail (opcional)</Label>
                  <Input placeholder="email@email.com" value={cardEmail} onChange={(e) => setCardEmail(e.target.value)} />
                </div>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor</span>
                      <span className="font-bold text-primary">{formatCurrency(amount)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={loading} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <Button onClick={handleProcessPayment} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {loading ? "Processando..." : "Pagar"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Result */}
        {step === 4 && (
          <div className="space-y-4">
            {billingType === "CREDIT_CARD" && (
              <div className="text-center space-y-2 py-4">
                <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="font-semibold text-foreground">Pagamento Aprovado!</p>
                <p className="text-sm text-muted-foreground">Seu pagamento foi processado com sucesso.</p>
              </div>
            )}

            {billingType === "PIX" && (
              <div className="space-y-3">
                {pixQrCode && (
                  <div className="flex justify-center">
                    <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code PIX" className="w-48 h-48 rounded-lg border border-border" />
                  </div>
                )}
                {pixCopyPaste && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código PIX (copia e cola)</Label>
                    <div className="flex gap-2">
                      <Input value={pixCopyPaste} readOnly className="text-xs" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(pixCopyPaste)}>
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}
                <Badge className="w-full justify-center py-1.5 bg-amber-500/10 text-amber-600 border-amber-200">
                  Aguardando pagamento
                </Badge>
              </div>
            )}

            {billingType === "BOLETO" && (
              <div className="space-y-3 text-center py-2">
                <FileText className="w-12 h-12 mx-auto text-primary" />
                <p className="font-medium text-foreground">Boleto gerado com sucesso!</p>
                {boletoUrl && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(boletoUrl, "_blank")}>
                    Abrir Boleto
                  </Button>
                )}
                {invoiceUrl && (
                  <Button variant="ghost" className="w-full" onClick={() => window.open(invoiceUrl, "_blank")}>
                    Ver Fatura
                  </Button>
                )}
                <Badge className="w-full justify-center py-1.5 bg-amber-500/10 text-amber-600 border-amber-200">
                  Vencimento em 3 dias úteis
                </Badge>
              </div>
            )}

            <Button className="w-full" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentCheckoutDialog;
