import { Agreement } from "@/services/agreementService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Trash2 } from "lucide-react";
import { formatCurrency, formatCPF } from "@/lib/formatters";
import { format } from "date-fns";

interface AgreementsListProps {
  agreements: Agreement[];
  isAdmin: boolean;
  onApprove: (agreement: Agreement) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};

const AgreementsList = ({ agreements, isAdmin, onApprove, onReject, onCancel }: AgreementsListProps) => {
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
            <TableHead className="text-right">Original</TableHead>
            <TableHead className="text-right">Proposto</TableHead>
            <TableHead className="text-center">Parcelas</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead className="text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {agreements.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.client_name}</TableCell>
              <TableCell>{formatCPF(a.client_cpf)}</TableCell>
              <TableCell>{a.credor}</TableCell>
              <TableCell className="text-right">{formatCurrency(a.original_total)}</TableCell>
              <TableCell className="text-right">{formatCurrency(a.proposed_total)}</TableCell>
              <TableCell className="text-center">{a.new_installments}x {formatCurrency(a.new_installment_value)}</TableCell>
              <TableCell>{format(new Date(a.first_due_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
              <TableCell>
                <Badge className={statusColors[a.status] || ""}>{statusLabels[a.status] || a.status}</Badge>
              </TableCell>
              {isAdmin && (
                <TableCell className="text-right">
                  {a.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => onApprove(a)} title="Aprovar">
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onReject(a.id)} title="Rejeitar">
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                  {a.status !== "pending" && a.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" onClick={() => onCancel(a.id)} title="Cancelar">
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AgreementsList;
