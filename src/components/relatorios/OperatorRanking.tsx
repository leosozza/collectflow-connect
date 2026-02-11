import { useMemo } from "react";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy } from "lucide-react";

interface OperatorRankingProps {
  clients: Client[];
  operators: { id: string; name: string }[];
}

const OperatorRanking = ({ clients, operators }: OperatorRankingProps) => {
  const ranking = useMemo(() => {
    const map = new Map<string, { received: number; broken: number; total: number; count: number }>();

    clients.forEach((c) => {
      const opId = c.operator_id || "sem-operador";
      if (!map.has(opId)) map.set(opId, { received: 0, broken: 0, total: 0, count: 0 });
      const entry = map.get(opId)!;
      entry.total += Number(c.valor_parcela);
      entry.count += 1;
      if (c.status === "pago") entry.received += Number(c.valor_pago);
      if (c.status === "quebrado") entry.broken += Number(c.valor_parcela);
    });

    return Array.from(map.entries())
      .map(([opId, stats]) => {
        const op = operators.find((o) => o.id === opId);
        const resolved = stats.received + stats.broken;
        const pctReceived = resolved > 0 ? (stats.received / (stats.received + stats.broken)) * 100 : 0;
        return {
          id: opId,
          name: op?.name || "Sem operador",
          ...stats,
          pctReceived,
        };
      })
      .sort((a, b) => b.received - a.received);
  }, [clients, operators]);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-card-foreground">Ranking de Operadores</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs w-10">#</TableHead>
            <TableHead className="text-xs">Operador</TableHead>
            <TableHead className="text-xs text-center">Parcelas</TableHead>
            <TableHead className="text-xs text-right">Recebido</TableHead>
            <TableHead className="text-xs text-right">Quebra</TableHead>
            <TableHead className="text-xs text-right">% Sucesso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranking.map((op, idx) => (
            <TableRow key={op.id}>
              <TableCell className="text-sm font-bold text-primary">{idx + 1}</TableCell>
              <TableCell className="text-sm font-medium">{op.name}</TableCell>
              <TableCell className="text-sm text-center">{op.count}</TableCell>
              <TableCell className="text-sm text-right text-success">{formatCurrency(op.received)}</TableCell>
              <TableCell className="text-sm text-right text-destructive">{formatCurrency(op.broken)}</TableCell>
              <TableCell className="text-sm text-right font-medium">{op.pctReceived.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
          {ranking.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">
                Nenhum dado disponível
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default OperatorRanking;
