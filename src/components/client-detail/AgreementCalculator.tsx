import { useState, useMemo } from "react";
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
import { Calculator, FileCheck, Loader2 } from "lucide-react";
import { enrichClientAddress } from "@/services/addressEnrichmentService";

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

  const originalTotal = useMemo(() => {
    return pendentes
      .filter((c) => selectedIds.has(c.id))
      .reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  }, [pendentes, selectedIds]);

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
      // Enrich address before creating agreement
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

      await createAgreement(data, user.id, profile.tenant_id);
      toast.success("Acordo gerado com sucesso!");
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
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
            {enrichingAddress ? addressStatus : submitting ? "Gerando..." : "Gerar Acordo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgreementCalculator;
