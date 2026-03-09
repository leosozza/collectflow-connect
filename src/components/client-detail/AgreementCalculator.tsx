import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createAgreement, AgreementFormData } from "@/services/agreementService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Calculator, FileCheck, Loader2, AlertTriangle, Play, Copy } from "lucide-react";
import { enrichClientAddress } from "@/services/addressEnrichmentService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchCredorRules, type CredorRulesResult } from "@/services/cadastrosService";

interface AgreementCalculatorProps {
  clients: any[];
  cpf: string;
  clientName: string;
  credor: string;
  onAgreementCreated: () => void;
  hasActiveAgreement?: boolean;
}

interface SimulatedInstallment {
  number: number;
  method: string;
  dueDate: string;
  value: number;
}

const AgreementCalculator = ({ clients, cpf, clientName, credor, onAgreementCreated, hasActiveAgreement }: AgreementCalculatorProps) => {
  const { user, profile } = useAuth();
  const pendentes = clients.filter((c) => c.status === "pendente" || c.status === "vencido");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(pendentes.map((c) => c.id)));
  const [calcDate, setCalcDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [jurosPercent, setJurosPercent] = useState<number>(0);
  const [multaPercent, setMultaPercent] = useState<number>(0);
  const [honorariosPercent, setHonorariosPercent] = useState<number>(0);
  const [descontoPercent, setDescontoPercent] = useState<number>(0);

  // Agreement form
  const [entradaDate, setEntradaDate] = useState("");
  const [entradaValue, setEntradaValue] = useState<number | "">(0);
  const [numParcelas, setNumParcelas] = useState<number>(1);
  const [formaPagto, setFormaPagto] = useState("BOLETO");
  const [intervalo, setIntervalo] = useState("mensal");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Simulation state
  const [simulated, setSimulated] = useState(false);
  const [simulatedInstallments, setSimulatedInstallments] = useState<SimulatedInstallment[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [enrichingAddress, setEnrichingAddress] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [credorRules, setCredorRules] = useState<CredorRulesResult | null>(null);

  // Fetch credor rules and auto-fill honorários + aging discount
  useEffect(() => {
    if (!profile?.tenant_id || !credor) return;
    fetchCredorRules(profile.tenant_id, credor).then((rules) => {
      if (rules) {
        setCredorRules(rules);
        setJurosPercent(rules.juros_mes || 0);
        setMultaPercent(rules.multa || 0);

        // Auto-calculate honorários from grade based on total original value
        const totalOriginal = pendentes.reduce((s, c) => s + (Number(c.valor_parcela) || Number(c.valor_saldo) || 0), 0);
        if (rules.honorarios_grade && rules.honorarios_grade.length > 0) {
          const matchedTier = rules.honorarios_grade.find((tier: any) => {
            const parts = (tier.faixa || "").split("-").map(Number);
            if (parts.length !== 2) return false;
            return totalOriginal >= parts[0] && totalOriginal <= parts[1];
          });
          if (matchedTier) {
            setHonorariosPercent(Number(matchedTier.honorario) || 0);
          }
        }

        // Auto-calculate discount from aging tiers based on max delay
        const refDate = new Date();
        const maxAtraso = pendentes.reduce((max, c) => {
          const venc = new Date(c.data_vencimento + "T00:00:00");
          const atraso = Math.max(0, Math.floor((refDate.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
          return Math.max(max, atraso);
        }, 0);

        if (rules.aging_discount_tiers && rules.aging_discount_tiers.length > 0) {
          const matchedAging = rules.aging_discount_tiers.find((tier: any) =>
            maxAtraso >= (tier.min_days || 0) && maxAtraso <= (tier.max_days || Infinity)
          );
          setDescontoPercent(matchedAging ? Number(matchedAging.discount_percent) || 0 : 0);
        } else {
          setDescontoPercent(0);
        }
      }
    });
  }, [profile?.tenant_id, credor]);

  // Reset simulation when params change
  useEffect(() => {
    setSimulated(false);
    setSimulatedInstallments([]);
  }, [selectedIds, jurosPercent, multaPercent, honorariosPercent, descontoPercent, entradaValue, numParcelas, firstDueDate, formaPagto, intervalo]);

  const numEntrada = typeof entradaValue === "number" ? entradaValue : 0;

  // Per-row calculations
  const rowCalcs = useMemo(() => {
    const refDate = new Date(calcDate + "T00:00:00");
    return pendentes.map((c) => {
      const venc = new Date(c.data_vencimento + "T00:00:00");
      const atraso = Math.max(0, Math.floor((refDate.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
      const mesesAtraso = Math.max(0, (refDate.getFullYear() - venc.getFullYear()) * 12 + (refDate.getMonth() - venc.getMonth()));
      const valorOriginal = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
      const valorBase = valorOriginal;
      const jurosVal = valorBase * (jurosPercent / 100) * mesesAtraso;
      const multaVal = atraso > 0 ? valorBase * (multaPercent / 100) : 0;
      const honorariosVal = valorBase * (honorariosPercent / 100);
      const total = valorBase + jurosVal + multaVal + honorariosVal;
      return { id: c.id, atraso, valorOriginal, valorBase, jurosVal, multaVal, honorariosVal, total };
    });
  }, [pendentes, calcDate, jurosPercent, multaPercent, honorariosPercent]);

  // Totals from selected rows
  const totals = useMemo(() => {
    const selected = rowCalcs.filter((r) => selectedIds.has(r.id));
    const totalOriginal = selected.reduce((s, r) => s + r.valorOriginal, 0);
    const totalBase = selected.reduce((s, r) => s + r.valorBase, 0);
    const totalJuros = selected.reduce((s, r) => s + r.jurosVal, 0);
    const totalMulta = selected.reduce((s, r) => s + r.multaVal, 0);
    const totalHonorarios = selected.reduce((s, r) => s + r.honorariosVal, 0);
    const totalBruto = selected.reduce((s, r) => s + r.total, 0);
    const descontoVal = totalBruto * (descontoPercent / 100);
    const totalAtualizado = Math.max(0, totalBruto - descontoVal);
    return { totalOriginal, totalBase, totalJuros, totalMulta, totalHonorarios, totalBruto, descontoVal, totalAtualizado };
  }, [rowCalcs, selectedIds, descontoPercent]);

  const remainingAfterEntrada = Math.max(0, totals.totalAtualizado - numEntrada);
  const installmentValue = numParcelas > 0 ? remainingAfterEntrada / numParcelas : 0;

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pendentes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendentes.map((c) => c.id)));
  };

  const handleSimulate = useCallback(() => {
    if (!firstDueDate) {
      toast.error("Informe a data do 1º vencimento");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos um título");
      return;
    }

    const installments: SimulatedInstallment[] = [];

    // Add entrada as installment 0 if present
    if (numEntrada > 0 && entradaDate) {
      installments.push({
        number: 0,
        method: formaPagto,
        dueDate: entradaDate,
        value: numEntrada,
      });
    }

    const baseDate = new Date(firstDueDate + "T00:00:00");
    for (let i = 0; i < numParcelas; i++) {
      const d = new Date(baseDate);
      if (intervalo === "mensal") {
        d.setMonth(d.getMonth() + i);
      } else if (intervalo === "quinzenal") {
        d.setDate(d.getDate() + i * 15);
      } else {
        d.setDate(d.getDate() + i * 7);
      }
      installments.push({
        number: i + 1,
        method: formaPagto,
        dueDate: d.toISOString().split("T")[0],
        value: installmentValue,
      });
    }

    setSimulatedInstallments(installments);
    setSimulated(true);
  }, [firstDueDate, selectedIds, numEntrada, entradaDate, formaPagto, numParcelas, intervalo, installmentValue]);

  // Out-of-standard detection
  const outOfStandard = useMemo(() => {
    if (!credorRules) return { isOut: false, reasons: [] as string[] };
    const reasons: string[] = [];
    if (credorRules.desconto_maximo > 0 && descontoPercent > credorRules.desconto_maximo) {
      reasons.push(`Desconto ${descontoPercent}% excede máx ${credorRules.desconto_maximo}%`);
    }
    if (credorRules.parcelas_max > 0 && numParcelas > credorRules.parcelas_max) {
      reasons.push(`Parcelas ${numParcelas}x excede máx ${credorRules.parcelas_max}x`);
    }
    return { isOut: reasons.length > 0, reasons };
  }, [credorRules, descontoPercent, numParcelas]);

  const handleSubmit = async () => {
    if (!user || !profile?.tenant_id) { toast.error("Usuário não autenticado"); return; }
    if (!simulated) { toast.error("Simule o acordo antes de gravar"); return; }

    setSubmitting(true);
    setEnrichingAddress(true);
    setAddressStatus("Buscando endereço...");
    try {
      await enrichClientAddress(cpf, profile.tenant_id, (msg) => setAddressStatus(msg));
      setEnrichingAddress(false);
      setAddressStatus("");

      const data: AgreementFormData = {
        client_cpf: cpf,
        client_name: clientName,
        credor,
        original_total: totals.totalOriginal,
        proposed_total: totals.totalAtualizado,
        discount_percent: descontoPercent,
        new_installments: numParcelas,
        new_installment_value: installmentValue,
        first_due_date: firstDueDate,
        entrada_value: numEntrada > 0 ? numEntrada : undefined,
        entrada_date: numEntrada > 0 && entradaDate ? entradaDate : undefined,
        notes: notes || undefined,
      };

      await createAgreement(data, user.id, profile.tenant_id, outOfStandard.isOut ? {
        requiresApproval: true,
        approvalReason: outOfStandard.reasons.join("; "),
      } : undefined);

      toast.success(outOfStandard.isOut ? "Solicitação de liberação enviada!" : "Acordo gravado com sucesso!");
      onAgreementCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gravar acordo");
    } finally {
      setSubmitting(false);
      setEnrichingAddress(false);
      setAddressStatus("");
    }
  };

  const copyTitles = () => {
    const selected = pendentes.filter((c) => selectedIds.has(c.id));
    const text = selected.map((c) => `${c.numero_parcela}/${c.total_parcelas} - ${formatDate(c.data_vencimento)} - ${formatCurrency(Number(c.valor_parcela) || 0)}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Títulos copiados!");
  };

  const simulatedTotal = simulatedInstallments.reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-2">
      {hasActiveAgreement && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Este cliente já possui um acordo vigente. Cancele o anterior para criar um novo.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Section 1: Parameters Bar ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Cálculo
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={copyTitles} className="gap-1 text-xs">
              <Copy className="w-3 h-3" /> Copiar Títulos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-end gap-2 flex-nowrap overflow-x-auto">
            <div className="space-y-0.5 min-w-[120px]">
              <Label className="text-[10px]">Data Cálculo</Label>
              <Input type="date" value={calcDate} onChange={(e) => setCalcDate(e.target.value)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Juros</Label>
              <Input type="number" min={0} step={0.01} value={jurosPercent} onChange={(e) => setJurosPercent(Number(e.target.value) || 0)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Multa</Label>
              <Input type="number" min={0} step={0.01} value={multaPercent} onChange={(e) => setMultaPercent(Number(e.target.value) || 0)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Honor.</Label>
              <Input type="number" min={0} step={0.01} value={honorariosPercent} onChange={(e) => setHonorariosPercent(Number(e.target.value) || 0)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Desc.</Label>
              <Input type="number" min={0} max={100} step={0.01} value={descontoPercent} onChange={(e) => setDescontoPercent(Number(e.target.value) || 0)} className="h-7 text-xs px-2" />
            </div>
            <div className="ml-auto flex items-center gap-2 whitespace-nowrap border border-border rounded-md px-3 py-1.5 bg-muted/50">
              <span className="text-[10px] text-muted-foreground">Valor Atualizado</span>
              <span className="text-sm font-bold text-foreground">{formatCurrency(totals.totalAtualizado)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Expanded Titles Table ── */}
      <Card>
        <CardContent className="p-0">
          {pendentes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Nenhum título pendente</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px]">
                    <TableHead className="w-8 px-2">
                      <Checkbox checked={selectedIds.size === pendentes.length && pendentes.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="px-2">Parc</TableHead>
                    <TableHead className="px-2">Vencimento</TableHead>
                    <TableHead className="px-2 text-right">Atraso</TableHead>
                    <TableHead className="px-2 text-right">V. Original</TableHead>
                    <TableHead className="px-2 text-right">Juros</TableHead>
                    <TableHead className="px-2 text-right">Multa</TableHead>
                    <TableHead className="px-2 text-right">Honorários</TableHead>
                    <TableHead className="px-2 text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.map((c, idx) => {
                    const row = rowCalcs[idx];
                    const isSelected = selectedIds.has(c.id);
                    return (
                      <TableRow key={c.id} className={`text-xs ${isSelected ? "bg-primary/5" : "opacity-50"}`}>
                        <TableCell className="px-2">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleId(c.id)} />
                        </TableCell>
                        <TableCell className="px-2 font-medium">{c.numero_parcela}/{c.total_parcelas}</TableCell>
                        <TableCell className="px-2">{formatDate(c.data_vencimento)}</TableCell>
                        <TableCell className="px-2 text-center text-xs text-muted-foreground">
                          {row.atraso}
                        </TableCell>
                        <TableCell className="px-2 text-right">{formatCurrency(row.valorOriginal)}</TableCell>
                        <TableCell className="px-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(row.jurosVal)}</TableCell>
                        <TableCell className="px-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(row.multaVal)}</TableCell>
                        <TableCell className="px-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(row.honorariosVal)}</TableCell>
                        <TableCell className="px-2 text-right font-semibold">{formatCurrency(row.total)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/30 text-xs font-semibold border-t-2">
                    <TableCell colSpan={4} className="px-2 text-right">Totais ({selectedIds.size} títulos)</TableCell>
                    <TableCell className="px-2 text-right">{formatCurrency(totals.totalOriginal)}</TableCell>
                    <TableCell className="px-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(totals.totalJuros)}</TableCell>
                    <TableCell className="px-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(totals.totalMulta)}</TableCell>
                    <TableCell className="px-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(totals.totalHonorarios)}</TableCell>
                    <TableCell className="px-2 text-right">{formatCurrency(totals.totalBruto)}</TableCell>
                  </TableRow>
                  {descontoPercent > 0 && (
                    <TableRow className="text-xs">
                      <TableCell colSpan={8} className="px-2 text-right text-emerald-600 dark:text-emerald-400">Desconto ({descontoPercent}%)</TableCell>
                      <TableCell className="px-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">- {formatCurrency(totals.descontoVal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Two-column — Form + Simulation ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Agreement Form */}
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-sm">Condições do Acordo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Data Entrada</Label>
                <Input type="date" value={entradaDate} onChange={(e) => setEntradaDate(e.target.value)} className="h-7 text-xs px-2" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Valor Entrada</Label>
                <Input type="number" min={0} value={entradaValue} onChange={(e) => setEntradaValue(e.target.value === "" ? "" : Number(e.target.value))} className="h-7 text-xs px-2" placeholder="0,00" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Parcelas</Label>
                <Input type="number" min={1} value={numParcelas} onChange={(e) => setNumParcelas(Number(e.target.value) || 1)} className="h-7 text-xs px-2" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Forma Pagto</Label>
                <Select value={formaPagto} onValueChange={setFormaPagto}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CARTAO">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Intervalo</Label>
                <Select value={intervalo} onValueChange={setIntervalo}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Vencto 1ª Parc.</Label>
                <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className="h-7 text-xs px-2" />
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas..." rows={1} className="text-xs min-h-[28px]" />
            </div>
            <Button onClick={handleSimulate} className="w-full gap-2 h-8 text-xs" variant="secondary" disabled={selectedIds.size === 0}>
              <Play className="w-3 h-3" />
              SIMULAR
            </Button>
          </CardContent>
        </Card>

        {/* Right: Simulation Results */}
        <Card className={`transition-opacity ${simulated ? "opacity-100" : "opacity-40"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {simulated ? "Simulação do Acordo" : "Clique em SIMULAR"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {simulated && simulatedInstallments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 text-[11px]">
                      <TableHead className="px-3">Parcela</TableHead>
                      <TableHead className="px-3">Forma Pagto</TableHead>
                      <TableHead className="px-3">Vencimento</TableHead>
                      <TableHead className="px-3 text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulatedInstallments.map((inst) => (
                      <TableRow key={inst.number} className="text-xs">
                        <TableCell className="px-3 font-medium">
                          {inst.number === 0 ? "Entrada" : `${String(inst.number).padStart(2, "0")}/${String(numParcelas).padStart(2, "0")}`}
                        </TableCell>
                        <TableCell className="px-3">
                          <Badge variant="outline" className="text-[10px]">{inst.method}</Badge>
                        </TableCell>
                        <TableCell className="px-3">{formatDate(inst.dueDate)}</TableCell>
                        <TableCell className="px-3 text-right font-medium">{formatCurrency(inst.value)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-emerald-50 dark:bg-emerald-950/30 border-t-2 text-xs font-bold">
                      <TableCell colSpan={3} className="px-3 text-right">Total do Acordo:</TableCell>
                      <TableCell className="px-3 text-right text-emerald-700 dark:text-emerald-400 text-sm">
                        {formatCurrency(simulatedTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-xs">
                Preencha as condições e clique em <strong>SIMULAR</strong> para visualizar as parcelas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Section 4: Actions Bar ── */}
      {outOfStandard.isOut && (
        <Alert variant="destructive" className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            <strong>Acordo fora do padrão:</strong> {outOfStandard.reasons.join("; ")}.
            Será enviado para liberação.
          </AlertDescription>
        </Alert>
      )}

      {enrichingAddress && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {addressStatus}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !simulated || hasActiveAgreement}
          className="flex-1 gap-2"
          size="lg"
          variant={outOfStandard.isOut ? "outline" : "default"}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : outOfStandard.isOut ? <AlertTriangle className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
          {enrichingAddress ? addressStatus : submitting ? "Gravando..." : outOfStandard.isOut ? "SOLICITAR LIBERAÇÃO" : "GRAVAR ACORDO"}
        </Button>
      </div>
    </div>
  );
};

export default AgreementCalculator;
