import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@/services/clientService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { AlertTriangle, CalendarClock, Headset, Download } from "lucide-react";
import { exportToExcel } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { startOfDay, parseISO, isEqual } from "date-fns";
import PropensityBadge from "./PropensityBadge";

interface CarteiraTableProps {
  clients: Client[];
  loading: boolean;
  title: string;
  isOverdue?: boolean;
}

interface GroupedRow extends Client {
  valor_total: number;
  parcelas_count: number;
}

const CarteiraTable = ({ clients, loading, title, isOverdue = false }: CarteiraTableProps) => {
  const today = startOfDay(new Date());
  const navigate = useNavigate();

  const grouped = useMemo((): GroupedRow[] => {
    const map = new Map<string, Client[]>();
    clients.forEach(c => {
      const key = c.cpf.replace(/\D/g, "");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.values()).map(group => {
      const earliest = group.reduce((min, c) => c.data_vencimento < min.data_vencimento ? c : min, group[0]);
      const valorTotal = group.reduce((sum, c) => sum + (Number(c.valor_parcela) || Number(c.valor_saldo) || 0), 0);
      const maxScore = group.reduce((max, c) => Math.max(max, c.propensity_score ?? 0), 0);
      return {
        ...earliest,
        valor_total: valorTotal,
        parcelas_count: group.length,
        propensity_score: maxScore || null,
      };
    });
  }, [clients]);

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        {isOverdue ? (
          <AlertTriangle className="w-5 h-5 text-destructive" />
        ) : (
          <CalendarClock className="w-5 h-5 text-primary" />
        )}
        <h2 className="font-semibold text-card-foreground">{title}</h2>
        <span className="ml-auto text-sm text-muted-foreground">{grouped.length} registros</span>
        <Button
          variant="ghost"
          size="sm"
          className="print:hidden"
          onClick={() => {
            const rows = grouped.map((c) => ({
              Nome: c.nome_completo,
              CPF: c.cpf,
              Credor: c.credor,
              "1º Vencimento": c.data_vencimento,
              "Valor Total": c.valor_total,
              Parcelas: c.parcelas_count,
              Score: c.propensity_score ?? "",
            }));
            exportToExcel(rows, "Carteira", `carteira_${title.replace(/\s/g, "_").toLowerCase()}`);
          }}
        >
          <Download className="w-3.5 h-3.5 mr-1" /> Excel
        </Button>
      </div>

      {grouped.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Nenhum cliente encontrado neste período
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Credor</TableHead>
                
                <TableHead>1º Vencimento</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((client) => {
                const vencDate = parseISO(client.data_vencimento);
                const isToday = isEqual(startOfDay(vencDate), today);
                const isPast = vencDate < today;

                return (
                  <TableRow
                    key={client.id}
                    className={`transition-colors ${
                      isToday
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : isPast
                        ? "bg-destructive/5"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <TableCell className="font-medium text-card-foreground">
                      {client.nome_completo}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client.cpf}</TableCell>
                    <TableCell className="text-muted-foreground">{client.credor}</TableCell>
                    <TableCell>
                      <span className={isPast ? "text-destructive font-medium" : isToday ? "text-primary font-medium" : ""}>
                        {formatDate(client.data_vencimento)}
                        {isToday && " (Hoje)"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <PropensityBadge score={client.propensity_score} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/atendimento/${client.id}`)}
                        title="Atender"
                      >
                        <Headset className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default CarteiraTable;
