import { useMemo } from "react";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { differenceInDays, parseISO } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AgingReportProps {
  clients: Client[];
}

const BUCKETS = [
  { label: "0-30 dias", min: 0, max: 30 },
  { label: "31-60 dias", min: 31, max: 60 },
  { label: "61-90 dias", min: 61, max: 90 },
  { label: "90+ dias", min: 91, max: Infinity },
];

const AgingReport = ({ clients }: AgingReportProps) => {
  const today = new Date();

  const agingData = useMemo(() => {
    const overdue = clients.filter(
      (c) => c.status === "pendente" && parseISO(c.data_vencimento) < today
    );

    return BUCKETS.map((bucket) => {
      const items = overdue.filter((c) => {
        const days = differenceInDays(today, parseISO(c.data_vencimento));
        return days >= bucket.min && days <= bucket.max;
      });
      return {
        ...bucket,
        count: items.length,
        total: items.reduce((s, c) => s + Number(c.valor_parcela), 0),
      };
    });
  }, [clients]);

  const totalOverdue = agingData.reduce((s, b) => s + b.total, 0);
  const totalCount = agingData.reduce((s, b) => s + b.count, 0);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Aging da Carteira (Parcelas Vencidas)</h3>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs">Faixa</TableHead>
            <TableHead className="text-xs text-center">Quantidade</TableHead>
            <TableHead className="text-xs text-right">Valor Total</TableHead>
            <TableHead className="text-xs text-right">% do Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agingData.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="text-sm font-medium">{row.label}</TableCell>
              <TableCell className="text-sm text-center">{row.count}</TableCell>
              <TableCell className="text-sm text-right">{formatCurrency(row.total)}</TableCell>
              <TableCell className="text-sm text-right">
                {totalOverdue > 0 ? ((row.total / totalOverdue) * 100).toFixed(1) : "0"}%
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-semibold bg-muted/30">
            <TableCell className="text-sm">Total</TableCell>
            <TableCell className="text-sm text-center">{totalCount}</TableCell>
            <TableCell className="text-sm text-right">{formatCurrency(totalOverdue)}</TableCell>
            <TableCell className="text-sm text-right">100%</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default AgingReport;
