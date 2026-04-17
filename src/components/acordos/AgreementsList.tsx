import { Link } from "react-router-dom";
import { Agreement } from "@/services/agreementService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCPF } from "@/lib/formatters";

interface AgreementsListProps {
  agreements: Agreement[];
}

const statusColors: Record<string, string> = {
  pending: "bg-green-50 text-green-700 border border-green-300",
  pending_approval: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
  overdue: "bg-amber-100 text-amber-800",
};

const statusLabels: Record<string, string> = {
  pending: "Acordo Vigente",
  pending_approval: "Aguardando Liberação",
  approved: "Quitado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  overdue: "Vencido",
};

const installmentClassLabels: Record<string, string> = {
  pago: "Pago",
  vigente: "A Vencer",
  vencido: "Vencida",
  pending_confirmation: "Aguardando Confirmação",
};

const installmentClassColors: Record<string, string> = {
  pago: "bg-green-100 text-green-800 border border-green-300",
  vigente: "bg-blue-100 text-blue-800 border border-blue-300",
  vencido: "bg-amber-100 text-amber-800 border border-amber-300",
  pending_confirmation: "bg-purple-100 text-purple-800 border border-purple-300",
};

const AgreementsList = ({ agreements }: AgreementsListProps) => {
  if (agreements.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum acordo encontrado.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>Credor</TableHead>
            <TableHead>Operador</TableHead>
            <TableHead>Parcelas Pagas</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agreements.map((a) => {
            const paid = (a as any)._paidCount as number | undefined;
            const total = (a as any)._totalCount as number | undefined;
            const showCount = typeof paid === "number" && typeof total === "number";
            return (
              <TableRow key={a.id}>
                <TableCell>
                  <Link
                    to={`/carteira/${a.client_cpf.replace(/\D/g, "")}?tab=acordo`}
                    className="font-medium text-primary hover:underline"
                  >
                    {a.client_name}
                  </Link>
                </TableCell>
                <TableCell>{formatCPF(a.client_cpf)}</TableCell>
                <TableCell>{a.credor}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {(a as any).creator_name || "—"}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {showCount ? (
                    <span className={paid! > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                      {paid} / {total}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-block">
                    <Badge className={statusColors[a.status] || ""}>{statusLabels[a.status] || a.status}</Badge>
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default AgreementsList;
