import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins } from "lucide-react";
import type { TokenTransaction } from "@/types/tokens";
import { TRANSACTION_TYPE_COLORS, TRANSACTION_TYPE_LABELS } from "@/types/tokens";

interface TokenHistoryTableProps {
  transactions: TokenTransaction[];
  loading?: boolean;
}

const TokenHistoryTable = ({ transactions, loading }: TokenHistoryTableProps) => {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = typeFilter === "all"
    ? transactions
    : transactions.filter((t) => t.transaction_type === typeFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
        Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="purchase">Compra</SelectItem>
            <SelectItem value="consumption">Consumo</SelectItem>
            <SelectItem value="bonus">Bônus</SelectItem>
            <SelectItem value="refund">Reembolso</SelectItem>
            <SelectItem value="adjustment">Ajuste</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} transações</span>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Saldo Após</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Coins className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    <span className="text-muted-foreground ml-1 text-xs">
                      {new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: TRANSACTION_TYPE_COLORS[t.transaction_type] || "#6B7280",
                        color: TRANSACTION_TYPE_COLORS[t.transaction_type] || "#6B7280",
                      }}
                    >
                      {TRANSACTION_TYPE_LABELS[t.transaction_type] || t.transaction_type}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-mono font-medium ${t.amount > 0 ? "text-green-600" : "text-red-500"}`}>
                    {t.amount > 0 ? "+" : ""}{t.amount.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.service_code || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {t.description}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {t.balance_after.toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TokenHistoryTable;
