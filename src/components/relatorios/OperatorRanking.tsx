import { useMemo } from "react";
import { formatCurrency } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trophy, Download, Printer } from "lucide-react";
import { exportToExcel, printSection } from "@/lib/exportUtils";

interface Agreement {
  id: string;
  proposed_total: number;
  status: string;
  created_by: string;
}

interface OperatorRankingProps {
  agreements: Agreement[];
  operators: { id: string; name: string }[];
}

const OperatorRanking = ({ agreements, operators }: OperatorRankingProps) => {
  const ranking = useMemo(() => {
    const map = new Map<string, { received: number; broken: number; total: number; count: number }>();

    agreements.forEach((a) => {
      if (a.status === "rejected") return;
      const opId = a.created_by || "sem-operador";
      if (!map.has(opId)) map.set(opId, { received: 0, broken: 0, total: 0, count: 0 });
      const entry = map.get(opId)!;
      entry.count += 1;
      entry.total += Number(a.proposed_total);
      if (a.status === "completed") entry.received += Number(a.proposed_total);
      if (a.status === "cancelled") entry.broken += Number(a.proposed_total);
    });

    return Array.from(map.entries())
      .map(([opId, stats]) => {
        const op = operators.find((o) => o.id === opId);
        const resolved = stats.received + stats.broken;
        const pctReceived = resolved > 0 ? (stats.received / resolved) * 100 : 0;
        return {
          id: opId,
          name: op?.name || "Sem operador",
          ...stats,
          pctReceived,
        };
      })
      .sort((a, b) => b.received - a.received);
  }, [agreements, operators]);

  const handleExcel = () => {
    const rows = ranking.map((op, idx) => ({
      "#": idx + 1,
      Operador: op.name,
      Acordos: op.count,
      Recebido: op.received,
      Quebra: op.broken,
      "% Sucesso": op.pctReceived.toFixed(1) + "%",
    }));
    exportToExcel(rows, "Ranking", "ranking_operadores");
  };

  return (
    <div id="operator-ranking" className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">Ranking de Operadores</h3>
        </div>
        <div className="flex gap-1 print:hidden">
          <Button variant="ghost" size="sm" onClick={handleExcel}>
            <Download className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          <Button variant="ghost" size="sm" onClick={() => printSection("operator-ranking")}>
            <Printer className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs w-10">#</TableHead>
            <TableHead className="text-xs">Operador</TableHead>
            <TableHead className="text-xs text-center">Acordos</TableHead>
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
