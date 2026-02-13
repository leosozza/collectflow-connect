import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PartyPopper, QrCode, CreditCard, Layers, Plus, Trash2, Loader2, ExternalLink, Copy } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";

interface Agreement {
  id: string;
  client_name: string;
  client_cpf: string;
  credor: string;
  original_total: number;
  proposed_total: number;
  new_installments: number;
  new_installment_value: number;
  discount_percent: number | null;
  first_due_date: string;
  status: string;
  checkout_token: string;
}

interface Payment {
  id: string;
  payment_method: string;
  amount: number;
  status: string;
  payment_data: any;
}

interface PortalCheckoutProps {
  checkoutToken: string;
}

type PaymentMode = "pix" | "cartao" | "multi";

interface SplitItem {
  method: "pix" | "cartao";
  amount: string;
}

const PortalCheckout = ({ checkoutToken }: PortalCheckoutProps) => {
  const { toast } = useToast();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [processing, setProcessing] = useState(false);
  const [splits, setSplits] = useState<SplitItem[]>([
    { method: "pix", amount: "" },
    { method: "cartao", amount: "" },
  ]);

  const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-checkout`;

  const fetchData = async () => {
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-agreement", checkout_token: checkoutToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAgreement(data.agreement);
      setPayments(data.payments || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [checkoutToken]);

  const createPayment = async (method: "pix" | "cartao", amount: number) => {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-payment", checkout_token: checkoutToken, payment_method: method, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  };

  const handleSinglePayment = async (method: "pix" | "cartao") => {
    if (!agreement) return;
    setProcessing(true);
    try {
      const result = await createPayment(method, agreement.proposed_total);
      setPayments((prev) => [...prev, result.payment]);
      toast({ title: "Pagamento gerado!", description: `Cobrança via ${method.toUpperCase()} criada com sucesso.` });
      setMode(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleMultiPayment = async () => {
    if (!agreement) return;
    const total = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);
    if (Math.abs(total - agreement.proposed_total) > 0.01) {
      toast({ title: "Valor incorreto", description: `A soma deve ser ${formatCurrency(agreement.proposed_total)}`, variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      for (const sp of splits) {
        const amt = parseFloat(sp.amount);
        if (amt > 0) {
          await createPayment(sp.method, amt);
        }
      }
      toast({ title: "Pagamentos gerados!", description: "Todas as cobranças foram criadas." });
      setMode(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const paidTotal = payments.filter((p) => p.status !== "failed").reduce((s, p) => s + Number(p.amount), 0);
  const remaining = agreement ? agreement.proposed_total - paidTotal : 0;

  const updateSplitAmount = (index: number, value: string) => {
    const newSplits = [...splits];
    newSplits[index].amount = value;
    // Auto-calculate last field
    if (agreement && index === 0 && newSplits.length === 2) {
      const first = parseFloat(value) || 0;
      const rest = agreement.proposed_total - first;
      newSplits[1].amount = rest > 0 ? rest.toFixed(2) : "0";
    }
    setSplits(newSplits);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground">Acordo não encontrado ou link inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasPayments = payments.filter((p) => p.status !== "failed").length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 md:p-8">
      {/* Celebration header */}
      {!hasPayments && (
        <div className="text-center space-y-3">
          <PartyPopper className="w-16 h-16 mx-auto text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Parabéns! 🎉</h1>
          <p className="text-muted-foreground">Seu acordo foi aprovado. Escolha como deseja pagar.</p>
        </div>
      )}

      {/* Agreement summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Resumo do Acordo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Credor</span><span className="font-medium text-foreground">{agreement.credor}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Valor original</span><span className="line-through text-muted-foreground">{formatCurrency(agreement.original_total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Valor negociado</span><span className="font-bold text-foreground text-lg">{formatCurrency(agreement.proposed_total)}</span></div>
          {agreement.discount_percent && agreement.discount_percent > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Desconto</span><Badge className="bg-success text-success-foreground">{agreement.discount_percent}%</Badge></div>
          )}
          <div className="flex justify-between"><span className="text-muted-foreground">Parcelas</span><span className="text-foreground">{agreement.new_installments}x de {formatCurrency(agreement.new_installment_value)}</span></div>
          {remaining > 0 && remaining < agreement.proposed_total && (
            <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Saldo restante</span><span className="font-bold text-primary">{formatCurrency(remaining)}</span></div>
          )}
        </CardContent>
      </Card>

      {/* Existing payments */}
      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  {p.payment_method === "pix" ? <QrCode className="w-4 h-4 text-primary" /> : <CreditCard className="w-4 h-4 text-primary" />}
                  <span className="text-sm font-medium text-foreground">{p.payment_method.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{formatCurrency(p.amount)}</span>
                  <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "outline"}>
                    {p.status === "paid" ? "Pago" : p.status === "failed" ? "Falhou" : "Aguardando"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Payment methods - only show if there's remaining */}
      {remaining > 0.01 && (
        <>
          {!mode && (
            <div className="grid gap-3">
              <Button size="lg" className="h-14 text-base" onClick={() => handleSinglePayment("pix")} disabled={processing}>
                <QrCode className="w-5 h-5 mr-2" /> Pagar via PIX
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => handleSinglePayment("cartao")} disabled={processing}>
                <CreditCard className="w-5 h-5 mr-2" /> Pagar via Cartão
              </Button>
              <Button size="lg" variant="secondary" className="h-14 text-base" onClick={() => setMode("multi")} disabled={processing}>
                <Layers className="w-5 h-5 mr-2" /> Multi-pagamento
              </Button>
            </div>
          )}

          {mode === "multi" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Dividir pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {splits.map((sp, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Método {i + 1}</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={sp.method}
                        onChange={(e) => {
                          const ns = [...splits];
                          ns[i].method = e.target.value as "pix" | "cartao";
                          setSplits(ns);
                        }}
                      >
                        <option value="pix">PIX</option>
                        <option value="cartao">Cartão</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sp.amount}
                        onChange={(e) => updateSplitAmount(i, e.target.value)}
                        placeholder="0,00"
                      />
                    </div>
                    {splits.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => setSplits(splits.filter((_, j) => j !== i))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={() => setSplits([...splits, { method: "cartao", amount: "" }])}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar cartão
                </Button>

                <div className="text-sm text-muted-foreground">
                  Total: {formatCurrency(splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0))} / {formatCurrency(remaining)}
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" disabled={processing} onClick={handleMultiPayment}>
                    {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {processing ? "Processando..." : "Confirmar pagamentos"}
                  </Button>
                  <Button variant="outline" onClick={() => setMode(null)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {remaining <= 0.01 && payments.some((p) => p.status !== "failed") && (
        <Card className="border-success/30">
          <CardContent className="py-6 text-center">
            <p className="text-success font-semibold text-lg">✅ Todos os pagamentos foram gerados!</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde a confirmação dos pagamentos.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PortalCheckout;
