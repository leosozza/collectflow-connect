import { useState, useMemo } from "react";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { differenceInDays, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, FileText } from "lucide-react";
import { exportMultiSheetExcel, printSection } from "@/lib/exportUtils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface PrestacaoContasProps {
  clients: Client[];
  agreements: any[];
  operators: { id: string; name: string }[];
  credores: string[];
}

// === MÉTRICA DE CARTEIRA === Faixas de aging por parcela/título original
const AGING_BUCKETS = [
  { label: "0-30 dias", min: 0, max: 30 },
  { label: "31-90 dias", min: 31, max: 90 },
  { label: "91-180 dias", min: 91, max: 180 },
  { label: "181-365 dias", min: 181, max: 365 },
  { label: "366+ dias", min: 366, max: Infinity },
];

const PrestacaoContas = ({ clients, agreements, operators, credores }: PrestacaoContasProps) => {
  const [selectedCredor, setSelectedCredor] = useState("");
  const today = new Date();

  const credorAgreements = useMemo(
    () => (selectedCredor ? agreements.filter((a: any) => a.credor === selectedCredor && a.status !== "rejected") : []),
    [agreements, selectedCredor]
  );

  // === PARCELAS DETALHADAS === Mostrar apenas clientes com acordo gerado no Rivo
  const credorClients = useMemo(() => {
    if (!selectedCredor) return [];
    const cpfsComAcordo = new Set(credorAgreements.map((a: any) => a.client_cpf));
    return clients.filter((c) => c.credor === selectedCredor && cpfsComAcordo.has(c.cpf));
  }, [clients, selectedCredor, credorAgreements]);

  // === PAGAMENTO REAL CONSOLIDADO === Resumo por acordo com dados reais
  const summary = useMemo(() => {
    const activeAgreements = credorAgreements.filter((a: any) => a.status !== "cancelled");
    const valorNegociado = activeAgreements.reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
    const recebido = activeAgreements.reduce((s: number, a: any) => s + Number(a.total_paid_real || 0), 0);
    const pendente = activeAgreements.reduce((s: number, a: any) => s + Number(a.pending_balance_real || 0), 0);
    const quebra = credorAgreements.filter((a: any) => a.status === "cancelled").reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
    const taxa = (recebido + quebra) > 0 ? (recebido / (recebido + quebra)) * 100 : 0;
    return { total: credorAgreements.length, valorNegociado, recebido, pendente, quebra, taxa };
  }, [credorAgreements]);

  // === MÉTRICA DE CARTEIRA === Aging por parcelas vencidas + recebido
  const agingData = useMemo(() => {
    const overdue = credorClients.filter((c) => c.status === "pendente" && parseISO(c.data_vencimento) < today);
    const paid = credorClients.filter((c) => c.status === "pago");
    return AGING_BUCKETS.map((b) => {
      const items = overdue.filter((c) => {
        const d = differenceInDays(today, parseISO(c.data_vencimento));
        return d >= b.min && d <= b.max;
      });
      const paidItems = paid.filter((c) => {
        const d = differenceInDays(today, parseISO(c.data_vencimento));
        return d >= b.min && d <= b.max;
      });
      return {
        ...b,
        count: items.length,
        total: items.reduce((s, c) => s + Number(c.valor_parcela), 0),
        received: paidItems.reduce((s, c) => s + Number(c.valor_pago), 0),
      };
    });
  }, [credorClients]);

  // Agreements summary
  const acordosSummary = useMemo(() => {
    const total = credorAgreements.length;
    const aprovados = credorAgreements.filter((a: any) => a.status === "approved").length;
    const pendentes = credorAgreements.filter((a: any) => a.status === "pending" || a.status === "pending_approval").length;
    const vencidos = credorAgreements.filter((a: any) => a.status === "overdue").length;
    const pagos = credorAgreements.filter((a: any) => a.status === "completed").length;
    const cancelados = credorAgreements.filter((a: any) => a.status === "cancelled").length;
    const valorOriginal = credorAgreements.reduce((s: number, a: any) => s + Number(a.original_total), 0);
    const valorNegociado = credorAgreements.filter((a: any) => a.status !== "cancelled").reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
    return { total, aprovados, pendentes, vencidos, pagos, cancelados, valorOriginal, valorNegociado };
  }, [credorAgreements]);

  // === PAGAMENTO REAL CONSOLIDADO === Ranking por total_paid_real
  const opRanking = useMemo(() => {
    const map = new Map<string, { received: number; broken: number; count: number }>();
    credorAgreements.forEach((a: any) => {
      const opId = a.created_by || "sem-operador";
      if (!map.has(opId)) map.set(opId, { received: 0, broken: 0, count: 0 });
      const e = map.get(opId)!;
      e.count++;
      if (a.status !== "cancelled") e.received += Number(a.total_paid_real || 0);
      if (a.status === "cancelled") e.broken += Number(a.proposed_total);
    });
    return Array.from(map.entries())
      .map(([id, stats]) => ({ id, name: operators.find((o) => o.id === id)?.name || "Sem operador", ...stats }))
      .sort((a, b) => b.received - a.received);
  }, [credorAgreements, operators]);

  const handleExcel = () => {
    const resumoRows = [
      { Indicador: "Total Acordos", Valor: summary.total },
      { Indicador: "Valor Negociado", Valor: summary.valorNegociado },
      { Indicador: "Total Recebido", Valor: summary.recebido },
      { Indicador: "Total Pendente", Valor: summary.pendente },
      { Indicador: "Total Quebra", Valor: summary.quebra },
      { Indicador: "Taxa Recuperação (%)", Valor: summary.taxa.toFixed(1) },
    ];
    const totalOverdue = agingData.reduce((s, b) => s + b.total, 0);
    const agingRows = agingData.map((r) => ({
      Faixa: r.label,
      Quantidade: r.count,
      "Valor Total": r.total,
      Recebido: r.received,
      "%": totalOverdue > 0 ? ((r.total / totalOverdue) * 100).toFixed(1) + "%" : "0%",
    }));
    const acordosRows = credorAgreements.map((a: any) => ({
      Cliente: a.client_name,
      CPF: a.client_cpf,
      "Valor Original": a.original_total,
      "Valor Proposto": a.proposed_total,
      Parcelas: a.new_installments,
      "1º Vencimento": a.first_due_date,
      Status: a.status,
    }));
    const parcelasRows = credorClients.map((c) => ({
      Nome: c.nome_completo,
      CPF: c.cpf,
      Parcela: `${c.numero_parcela}/${c.total_parcelas}`,
      "Valor Parcela": Number(c.valor_parcela),
      "Valor Pago": Number(c.valor_pago),
      Vencimento: c.data_vencimento,
      Status: c.status,
    }));
    exportMultiSheetExcel(
      [
        { name: "Resumo", rows: resumoRows },
        { name: "Aging", rows: agingRows },
        { name: "Acordos", rows: acordosRows },
        { name: "Parcelas", rows: parcelasRows },
      ],
      `prestacao_contas_${selectedCredor.replace(/\s/g, "_")}`
    );
  };

  if (!selectedCredor) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Prestação de Contas</h2>
        </div>
        <p className="text-sm text-muted-foreground">Selecione um credor para gerar o relatório completo de prestação de contas.</p>
        <Select value={selectedCredor} onValueChange={setSelectedCredor}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Selecionar credor..." />
          </SelectTrigger>
          <SelectContent>
            {credores.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const totalOverdue = agingData.reduce((s, b) => s + b.total, 0);
  const totalReceived = agingData.reduce((s, b) => s + b.received, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Prestação de Contas</h2>
          <Select value={selectedCredor} onValueChange={setSelectedCredor}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {credores.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleExcel}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => printSection("prestacao-contas-content")}>
            <Printer className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div id="prestacao-contas-content" className="space-y-6">
        {/* Resumo based on agreements */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Acordos", value: summary.total },
            { label: "Valor Negociado", value: formatCurrency(summary.valorNegociado) },
            { label: "Recebido", value: formatCurrency(summary.recebido) },
            { label: "Pendente", value: formatCurrency(summary.pendente) },
            { label: "Quebra", value: formatCurrency(summary.quebra) },
            { label: "Taxa Recuperação", value: `${summary.taxa.toFixed(1)}%` },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-bold text-card-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        {/* === MÉTRICA DE CARTEIRA === Aging por parcelas */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Aging da Carteira (Parcelas)</h3>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Faixa</TableHead>
                <TableHead className="text-xs text-center">Qtd</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
                <TableHead className="text-xs text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agingData.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="text-sm">{r.label}</TableCell>
                  <TableCell className="text-sm text-center">{r.count}</TableCell>
                  <TableCell className="text-sm text-right">{formatCurrency(r.total)}</TableCell>
                  <TableCell className="text-sm text-right text-success">{formatCurrency(r.received)}</TableCell>
                  <TableCell className="text-sm text-right">{totalOverdue > 0 ? ((r.total / totalOverdue) * 100).toFixed(1) : "0"}%</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/30">
                <TableCell className="text-sm">Total</TableCell>
                <TableCell className="text-sm text-center">{agingData.reduce((s, b) => s + b.count, 0)}</TableCell>
                <TableCell className="text-sm text-right">{formatCurrency(totalOverdue)}</TableCell>
                <TableCell className="text-sm text-right text-success">{formatCurrency(totalReceived)}</TableCell>
                <TableCell className="text-sm text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Acordos */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Acordos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            {[
              { label: "Total", value: acordosSummary.total },
              { label: "Aprovados", value: acordosSummary.aprovados },
              { label: "Pendentes", value: acordosSummary.pendentes },
              { label: "Vencidos", value: acordosSummary.vencidos },
              { label: "Pagos", value: acordosSummary.pagos },
              { label: "Cancelados", value: acordosSummary.cancelados },
              { label: "Valor Negociado", value: formatCurrency(acordosSummary.valorNegociado) },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold text-card-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking operadores */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Ranking de Operadores</h3>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Operador</TableHead>
                <TableHead className="text-xs text-center">Acordos</TableHead>
                <TableHead className="text-xs text-right">Recebido</TableHead>
                <TableHead className="text-xs text-right">Quebra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opRanking.map((op, idx) => (
                <TableRow key={op.id}>
                  <TableCell className="text-sm font-bold text-primary">{idx + 1}</TableCell>
                  <TableCell className="text-sm">{op.name}</TableCell>
                  <TableCell className="text-sm text-center">{op.count}</TableCell>
                  <TableCell className="text-sm text-right text-success">{formatCurrency(op.received)}</TableCell>
                  <TableCell className="text-sm text-right text-destructive">{formatCurrency(op.broken)}</TableCell>
                </TableRow>
              ))}
              {opRanking.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-4">Sem dados</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* === PARCELAS DETALHADAS === Apenas clientes com acordo no Rivo, em accordion fechado */}
        <div className="bg-card rounded-xl border border-border p-5">
          <Accordion type="single" collapsible>
            <AccordionItem value="parcelas" className="border-none">
              <AccordionTrigger className="py-0 hover:no-underline">
                <h3 className="text-sm font-semibold text-card-foreground">
                  Parcelas Detalhadas ({credorClients.length})
                </h3>
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto max-h-96 mt-3">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Nome</TableHead>
                        <TableHead className="text-xs">CPF</TableHead>
                        <TableHead className="text-xs text-center">Parcela</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                        <TableHead className="text-xs text-right">Pago</TableHead>
                        <TableHead className="text-xs">Vencimento</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credorClients.slice(0, 200).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">{c.nome_completo}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.cpf}</TableCell>
                          <TableCell className="text-sm text-center">{c.numero_parcela}/{c.total_parcelas}</TableCell>
                          <TableCell className="text-sm text-right">{formatCurrency(Number(c.valor_parcela))}</TableCell>
                          <TableCell className="text-sm text-right">{formatCurrency(Number(c.valor_pago))}</TableCell>
                          <TableCell className="text-sm">{c.data_vencimento}</TableCell>
                          <TableCell className="text-sm capitalize">{c.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {credorClients.length > 200 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Exibindo 200 de {credorClients.length} — exporte em Excel para ver todos
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default PrestacaoContas;
