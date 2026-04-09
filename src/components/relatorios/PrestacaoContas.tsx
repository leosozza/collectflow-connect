import { useState, useMemo } from "react";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { differenceInDays, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, FileText } from "lucide-react";
import { exportMultiSheetExcel, printSection } from "@/lib/exportUtils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface PrestacaoContasProps {
  clients: Client[];
  agreements: any[];
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

/** Remove pontos, traços e espaços do CPF para comparação segura */
const normalizeCPF = (cpf: string) => (cpf || "").replace(/\D/g, "");

const PrestacaoContas = ({ clients, agreements, credores }: PrestacaoContasProps) => {
  const [selectedCredor, setSelectedCredor] = useState("");
  const today = new Date();

  // === MÉTRICA DE ACORDO === Acordos do credor selecionado (exceto rejeitados)
  const credorAgreements = useMemo(
    () => (selectedCredor ? agreements.filter((a: any) => a.credor === selectedCredor && a.status !== "rejected") : []),
    [agreements, selectedCredor]
  );

  // === PARCELAS DETALHADAS === Apenas clientes cujo CPF normalizado existe em acordos do credor
  const cpfsComAcordo = useMemo(() => {
    return new Set(credorAgreements.map((a: any) => normalizeCPF(a.client_cpf)));
  }, [credorAgreements]);

  const credorClients = useMemo(() => {
    if (!selectedCredor) return [];
    return clients.filter((c) => c.credor === selectedCredor && cpfsComAcordo.has(normalizeCPF(c.cpf)));
  }, [clients, selectedCredor, cpfsComAcordo]);

  // === PAGAMENTO REAL CONSOLIDADO === Resumo financeiro baseado nos acordos
  const summary = useMemo(() => {
    const activeAgreements = credorAgreements.filter((a: any) => a.status !== "cancelled");
    const valorNegociado = activeAgreements.reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
    const recebido = activeAgreements.reduce((s: number, a: any) => s + Number(a.total_paid_real || 0), 0);
    const pendente = activeAgreements.reduce((s: number, a: any) => s + Number(a.pending_balance_real || 0), 0);
    const quebra = credorAgreements.filter((a: any) => a.status === "cancelled").reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
    const taxa = (recebido + quebra) > 0 ? (recebido / (recebido + quebra)) * 100 : 0;

    // Contadores de clientes únicos por CPF normalizado
    const cpfsNegociados = new Set(credorAgreements.map((a: any) => normalizeCPF(a.client_cpf)));
    const cpfsRecebidos = new Set(
      activeAgreements.filter((a: any) => Number(a.total_paid_real || 0) > 0).map((a: any) => normalizeCPF(a.client_cpf))
    );
    const cpfsQuebrados = new Set(
      credorAgreements.filter((a: any) => a.status === "cancelled").map((a: any) => normalizeCPF(a.client_cpf))
    );

    return {
      total: credorAgreements.length,
      valorNegociado,
      recebido,
      pendente,
      quebra,
      taxa,
      clientesNegociados: cpfsNegociados.size,
      clientesRecebidos: cpfsRecebidos.size,
      clientesQuebrados: cpfsQuebrados.size,
    };
  }, [credorAgreements]);

  // === MÉTRICA DE CARTEIRA === Aging por parcelas de clientes com acordo
  // Usa saldo real (valor_parcela - valor_pago) em vez de depender apenas do status
  const agingData = useMemo(() => {
    return AGING_BUCKETS.map((b) => {
      let count = 0;
      let totalAberto = 0;
      let totalRecebido = 0;

      credorClients.forEach((c) => {
        const vencimento = parseISO(c.data_vencimento);
        const dias = differenceInDays(today, vencimento);
        if (dias < b.min || dias > b.max) return;

        const parcela = Number(c.valor_parcela) || 0;
        const pago = Number(c.valor_pago) || 0;
        const saldo = Math.max(parcela - pago, 0);

        // Soma recebido independentemente do status
        if (pago > 0) totalRecebido += pago;

        // Soma aberto para parcelas vencidas com saldo > 0
        if (vencimento < today && saldo > 0) {
          count++;
          totalAberto += saldo;
        }
      });

      return { ...b, count, total: totalAberto, received: totalRecebido };
    });
  }, [credorClients]);

  // === MÉTRICA DE ACORDO === Resumo por status de acordos
  const acordosSummary = useMemo(() => {
    const total = credorAgreements.length;
    const aprovados = credorAgreements.filter((a: any) => a.status === "approved").length;
    const pendentes = credorAgreements.filter((a: any) => a.status === "pending" || a.status === "pending_approval").length;
    const vencidos = credorAgreements.filter((a: any) => a.status === "overdue").length;
    // === PAGAMENTO REAL === Conta acordos que receberam qualquer pagamento real (completed OU com total_paid_real > 0)
    const pagos = credorAgreements.filter((a: any) => a.status === "completed" || Number(a.total_paid_real || 0) > 0).length;
    const cancelados = credorAgreements.filter((a: any) => a.status === "cancelled").length;
    const valorOriginal = credorAgreements.reduce((s: number, a: any) => s + Number(a.original_total), 0);
    const valorNegociado = credorAgreements.filter((a: any) => a.status !== "cancelled").reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
    return { total, aprovados, pendentes, vencidos, pagos, cancelados, valorOriginal, valorNegociado };
  }, [credorAgreements]);

  const handleExcel = () => {
    const resumoRows = [
      { Indicador: "Total Acordos", Valor: summary.total },
      { Indicador: "Clientes Negociados", Valor: summary.clientesNegociados },
      { Indicador: "Clientes com Recebimento", Valor: summary.clientesRecebidos },
      { Indicador: "Clientes Quebrados", Valor: summary.clientesQuebrados },
      { Indicador: "Valor Negociado", Valor: summary.valorNegociado },
      { Indicador: "Total Recebido", Valor: summary.recebido },
      { Indicador: "Total Pendente", Valor: summary.pendente },
      { Indicador: "Total Quebra", Valor: summary.quebra },
      { Indicador: "Taxa Recuperação (%)", Valor: summary.taxa.toFixed(1) },
    ];
    const totalAberto = agingData.reduce((s, b) => s + b.total, 0);
    const agingRows = agingData.map((r) => ({
      Faixa: r.label,
      "Parcelas Abertas": r.count,
      "Saldo Aberto": r.total,
      Recebido: r.received,
      "%": totalAberto > 0 ? ((r.total / totalAberto) * 100).toFixed(1) + "%" : "0%",
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

  const totalAberto = agingData.reduce((s, b) => s + b.total, 0);
  const totalRecebido = agingData.reduce((s, b) => s + b.received, 0);

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
        {/* === PAGAMENTO REAL CONSOLIDADO === KPIs financeiros + contagem de clientes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Acordos", value: summary.total },
            { label: "Valor Negociado", value: formatCurrency(summary.valorNegociado) },
            { label: "Recebido", value: formatCurrency(summary.recebido) },
            { label: "Pendente", value: formatCurrency(summary.pendente) },
            { label: "Taxa Recuperação", value: `${summary.taxa.toFixed(1)}%` },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-bold text-card-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Contadores de clientes únicos */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">Clientes Negociados</p>
            <p className="text-2xl font-bold text-primary">{summary.clientesNegociados}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">Clientes com Recebimento</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.clientesRecebidos}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">Clientes Quebrados</p>
            <p className="text-2xl font-bold text-destructive">{summary.clientesQuebrados}</p>
          </div>
        </div>

        {/* === MÉTRICA DE CARTEIRA === Aging por parcelas de clientes com acordo */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Aging da Carteira (Parcelas com Acordo)</h3>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Faixa</TableHead>
                <TableHead className="text-xs text-center">Parcelas Abertas</TableHead>
                <TableHead className="text-xs text-right">Saldo Aberto</TableHead>
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
                  <TableCell className="text-sm text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(r.received)}</TableCell>
                  <TableCell className="text-sm text-right">{totalAberto > 0 ? ((r.total / totalAberto) * 100).toFixed(1) : "0"}%</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/30">
                <TableCell className="text-sm">Total</TableCell>
                <TableCell className="text-sm text-center">{agingData.reduce((s, b) => s + b.count, 0)}</TableCell>
                <TableCell className="text-sm text-right">{formatCurrency(totalAberto)}</TableCell>
                <TableCell className="text-sm text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRecebido)}</TableCell>
                <TableCell className="text-sm text-right">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* === MÉTRICA DE ACORDO === Resumo por status de acordos */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Acordos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            {[
              { label: "Total", value: acordosSummary.total },
              { label: "Pagos", value: acordosSummary.pagos },
              { label: "Pendentes", value: acordosSummary.pendentes },
              { label: "Vencidos", value: acordosSummary.vencidos },
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
