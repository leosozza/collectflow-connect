import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createAgreement, AgreementFormData } from "@/services/agreementService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Calculator, FileCheck, Loader2, Zap, CreditCard, Banknote, AlertTriangle } from "lucide-react";
import { enrichClientAddress } from "@/services/addressEnrichmentService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface AgingTier {
  min_days: number;
  max_days: number;
  discount_percent: number;
}

interface CredorRules {
  desconto_maximo: number;
  juros_mes: number;
  multa: number;
  parcelas_max: number;
  parcelas_min: number;
  entrada_minima_valor: number;
  entrada_minima_tipo: string;
  aging_discount_tiers: AgingTier[];
}

interface AgreementCalculatorProps {
  clients: any[];
  cpf: string;
  clientName: string;
  credor: string;
  onAgreementCreated: () => void;
}

const AgreementCalculator = ({ clients, cpf, clientName, credor, onAgreementCreated }: AgreementCalculatorProps) => {
  const { user, profile } = useAuth();
  const pendentes = clients.filter((c) => c.status === "pendente");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(pendentes.map((c) => c.id)));
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountValue, setDiscountValue] = useState(0);
  const [entradaValue, setEntradaValue] = useState(0);
  const [entradaDate, setEntradaDate] = useState("");
  const [numParcelas, setNumParcelas] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enrichingAddress, setEnrichingAddress] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [credorRules, setCredorRules] = useState<CredorRules | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  // Fetch credor rules
  useEffect(() => {
    if (!profile?.tenant_id || !credor) return;
    const fetchCredor = async () => {
      const { data } = await supabase
        .from("credores" as any)
        .select("desconto_maximo, juros_mes, multa, parcelas_max, parcelas_min, entrada_minima_valor, entrada_minima_tipo, aging_discount_tiers")
        .eq("tenant_id", profile.tenant_id)
        .eq("razao_social", credor)
        .maybeSingle();
      if (data) {
        setCredorRules({
          desconto_maximo: Number((data as any).desconto_maximo) || 0,
          juros_mes: Number((data as any).juros_mes) || 0,
          multa: Number((data as any).multa) || 0,
          parcelas_max: Number((data as any).parcelas_max) || 12,
          parcelas_min: Number((data as any).parcelas_min) || 1,
          entrada_minima_valor: Number((data as any).entrada_minima_valor) || 0,
          entrada_minima_tipo: (data as any).entrada_minima_tipo || "percent",
          aging_discount_tiers: ((data as any).aging_discount_tiers as AgingTier[]) || [],
        });
      }
    };
    fetchCredor();
  }, [profile?.tenant_id, credor]);

  const originalTotal = useMemo(() => {
    return pendentes
      .filter((c) => selectedIds.has(c.id))
      .reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  }, [pendentes, selectedIds]);

  // Calculate aging days from oldest selected parcela
  const agingDays = useMemo(() => {
    const selected = pendentes.filter(c => selectedIds.has(c.id));
    if (selected.length === 0) return 0;
    const oldest = selected.reduce((min, c) => {
      const d = new Date(c.data_vencimento);
      return d < min ? d : min;
    }, new Date(selected[0].data_vencimento));
    const diff = Math.floor((Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [pendentes, selectedIds]);

  const getAgingDiscount = () => {
    if (!credorRules || credorRules.aging_discount_tiers.length === 0) {
      return credorRules?.desconto_maximo || 0;
    }
    const tier = credorRules.aging_discount_tiers.find(
      t => agingDays >= t.min_days && agingDays <= t.max_days
    );
    return tier ? tier.discount_percent : credorRules.desconto_maximo || 0;
  };

  const proposedTotal = useMemo(() => {
    return Math.max(0, originalTotal - discountValue);
  }, [originalTotal, discountValue]);

  const remainingAfterEntrada = useMemo(() => {
    return Math.max(0, proposedTotal - entradaValue);
  }, [proposedTotal, entradaValue]);

  const installmentValue = useMemo(() => {
    if (numParcelas <= 0) return 0;
    return remainingAfterEntrada / numParcelas;
  }, [remainingAfterEntrada, numParcelas]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pendentes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendentes.map((c) => c.id)));
    }
  };

  const handleDiscountPercent = (pct: number) => {
    setDiscountPercent(pct);
    setDiscountValue(Number(((originalTotal * pct) / 100).toFixed(2)));
  };

  const handleDiscountValue = (val: number) => {
    setDiscountValue(val);
    if (originalTotal > 0) {
      setDiscountPercent(Number(((val / originalTotal) * 100).toFixed(2)));
    }
  };

  // Model 1: À vista com desconto aging
  const applyModel1 = () => {
    const disc = getAgingDiscount();
    handleDiscountPercent(disc);
    setEntradaValue(0);
    setEntradaDate("");
    setNumParcelas(1);
    setActiveModel("avista");
    setNotes("Modelo: À Vista com desconto");
  };

  // Model 2: Entrada 30% + 5 parcelas
  const applyModel2 = () => {
    const disc = getAgingDiscount();
    handleDiscountPercent(disc);
    const proposedAfterDiscount = Math.max(0, originalTotal - Number(((originalTotal * disc) / 100).toFixed(2)));
    const entrada = Number((proposedAfterDiscount * 0.3).toFixed(2));
    setEntradaValue(entrada);
    setNumParcelas(5);
    setActiveModel("entrada");
    setNotes("Modelo: Entrada 30% + 5 parcelas");
  };

  // Model 3: Cartão - sem juros/multa, parcelado máximo
  const applyModel3 = () => {
    if (!credorRules) return;
    // Remove juros e multa do total
    const jurosMulta = originalTotal * ((credorRules.juros_mes + credorRules.multa) / 100);
    const valorSemJurosMulta = Math.max(0, originalTotal - jurosMulta);
    const discVal = originalTotal - valorSemJurosMulta;
    const discPct = originalTotal > 0 ? Number(((discVal / originalTotal) * 100).toFixed(2)) : 0;
    setDiscountPercent(discPct);
    setDiscountValue(Number(discVal.toFixed(2)));
    setEntradaValue(0);
    setEntradaDate("");
    setNumParcelas(credorRules.parcelas_max || 12);
    setActiveModel("cartao");
    setNotes("Modelo: Cartão sem juros/multa");
  };

  // Detect if agreement is out of standard
  const outOfStandard = useMemo(() => {
    if (!credorRules) return { isOut: false, reasons: [] as string[] };
    const reasons: string[] = [];
    if (credorRules.desconto_maximo > 0 && discountPercent > credorRules.desconto_maximo) {
      reasons.push(`Desconto ${discountPercent}% excede o máximo de ${credorRules.desconto_maximo}%`);
    }
    if (credorRules.parcelas_max > 0 && numParcelas > credorRules.parcelas_max) {
      reasons.push(`Parcelas ${numParcelas}x excede o máximo de ${credorRules.parcelas_max}x`);
    }
    if (credorRules.entrada_minima_valor > 0 && entradaValue > 0) {
      if (credorRules.entrada_minima_tipo === "percent") {
        const minEntrada = proposedTotal * (credorRules.entrada_minima_valor / 100);
        if (entradaValue < minEntrada) {
          reasons.push(`Entrada R$ ${entradaValue.toFixed(2)} abaixo do mínimo de ${credorRules.entrada_minima_valor}% (R$ ${minEntrada.toFixed(2)})`);
        }
      } else {
        if (entradaValue < credorRules.entrada_minima_valor) {
          reasons.push(`Entrada R$ ${entradaValue.toFixed(2)} abaixo do mínimo de R$ ${credorRules.entrada_minima_valor.toFixed(2)}`);
        }
      }
    }
    return { isOut: reasons.length > 0, reasons };
  }, [credorRules, discountPercent, numParcelas, entradaValue, proposedTotal]);

  const handleSubmit = async () => {
    if (!user || !profile?.tenant_id) {
      toast.error("Usuário não autenticado");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma parcela");
      return;
    }
    if (!firstDueDate) {
      toast.error("Informe a data do 1º vencimento");
      return;
    }

    setSubmitting(true);
    setEnrichingAddress(true);
    setAddressStatus("Buscando endereço...");
    try {
      await enrichClientAddress(cpf, profile.tenant_id, (msg) => setAddressStatus(msg));
      setEnrichingAddress(false);
      setAddressStatus("");

      const totalInstallments = entradaValue > 0 ? numParcelas + 1 : numParcelas;
      const data: AgreementFormData = {
        client_cpf: cpf,
        client_name: clientName,
        credor,
        original_total: originalTotal,
        proposed_total: proposedTotal,
        discount_percent: discountPercent,
        new_installments: totalInstallments,
        new_installment_value: installmentValue,
        first_due_date: firstDueDate,
        notes: notes || undefined,
      };

      await createAgreement(data, user.id, profile.tenant_id, outOfStandard.isOut ? {
        requiresApproval: true,
        approvalReason: outOfStandard.reasons.join("; "),
      } : undefined);

      toast.success(outOfStandard.isOut ? "Solicitação de liberação enviada!" : "Acordo gerado com sucesso!");
      onAgreementCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar acordo");
    } finally {
      setSubmitting(false);
      setEnrichingAddress(false);
      setAddressStatus("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Parcelas selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Selecione as parcelas para o acordo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendentes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhuma parcela pendente</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === pendentes.length && pendentes.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((c) => (
                  <TableRow key={c.id} className={selectedIds.has(c.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(c.id)}
                        onCheckedChange={() => toggleId(c.id)}
                      />
                    </TableCell>
                    <TableCell>{c.numero_parcela}/{c.total_parcelas}</TableCell>
                    <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(c.valor_parcela))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preset Models */}
      {credorRules && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Modelos de Acordo</CardTitle>
            {agingDays > 0 && (
              <p className="text-xs text-muted-foreground">
                Aging: {agingDays} dias em aberto • Desconto sugerido: {getAgingDiscount()}%
              </p>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <Button
              variant={activeModel === "avista" ? "default" : "outline"}
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={applyModel1}
              type="button"
            >
              <Banknote className="w-5 h-5" />
              <span className="text-xs font-medium">À Vista</span>
              <span className="text-[10px] text-muted-foreground">{getAgingDiscount()}% desconto</span>
            </Button>
            <Button
              variant={activeModel === "entrada" ? "default" : "outline"}
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={applyModel2}
              type="button"
            >
              <Zap className="w-5 h-5" />
              <span className="text-xs font-medium">Entrada + Parcelas</span>
              <span className="text-[10px] text-muted-foreground">30% + 5x</span>
            </Button>
            <Button
              variant={activeModel === "cartao" ? "default" : "outline"}
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={applyModel3}
              type="button"
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs font-medium">Cartão</span>
              <span className="text-[10px] text-muted-foreground">Sem juros/multa</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Calculator */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          {/* Original total */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Total Original ({selectedIds.size} parcelas)</span>
            <span className="text-lg font-bold">{formatCurrency(originalTotal)}</span>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={discountPercent || ""}
                onChange={(e) => handleDiscountPercent(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Desconto (R$)</Label>
              <Input
                type="number"
                min={0}
                value={discountValue || ""}
                onChange={(e) => handleDiscountValue(Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Entrada */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Valor de Entrada (R$)</Label>
              <Input
                type="number"
                min={0}
                value={entradaValue || ""}
                onChange={(e) => setEntradaValue(Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data da Entrada</Label>
              <Input
                type="date"
                value={entradaDate}
                onChange={(e) => setEntradaDate(e.target.value)}
              />
            </div>
          </div>

          {/* Parcelas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nº de Parcelas</Label>
              <Input
                type="number"
                min={1}
                value={numParcelas}
                onChange={(e) => setNumParcelas(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data 1º Vencimento</Label>
              <Input
                type="date"
                value={firstDueDate}
                onChange={(e) => setFirstDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre o acordo..."
              rows={3}
            />
          </div>

          {/* Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm text-primary">Resumo do Acordo</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Valor Original:</span>
              <span className="text-right font-medium">{formatCurrency(originalTotal)}</span>
              <span className="text-muted-foreground">Desconto:</span>
              <span className="text-right font-medium text-green-600">- {formatCurrency(discountValue)} ({discountPercent}%)</span>
              <span className="text-muted-foreground">Valor Proposto:</span>
              <span className="text-right font-bold">{formatCurrency(proposedTotal)}</span>
              {entradaValue > 0 && (
                <>
                  <span className="text-muted-foreground">Entrada:</span>
                  <span className="text-right font-medium">{formatCurrency(entradaValue)}</span>
                </>
              )}
              <span className="text-muted-foreground">Demais Parcelas:</span>
              <span className="text-right font-medium">
                {numParcelas}x de {formatCurrency(installmentValue)}
              </span>
            </div>
          </div>

          {outOfStandard.isOut && (
            <Alert variant="destructive" className="border-orange-300 bg-orange-50 text-orange-800">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                <strong>Acordo fora do padrão:</strong> {outOfStandard.reasons.join("; ")}. 
                Será enviado para liberação por Supervisor/Gerente/Admin.
              </AlertDescription>
            </Alert>
          )}

          {enrichingAddress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {addressStatus}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedIds.size === 0 || !firstDueDate}
            className="w-full gap-2"
            size="lg"
            variant={outOfStandard.isOut ? "outline" : "default"}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : outOfStandard.isOut ? <AlertTriangle className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
            {enrichingAddress ? addressStatus : submitting ? "Gerando..." : outOfStandard.isOut ? "Solicitar Liberação" : "Gerar Acordo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgreementCalculator;
