import { useState } from "react";
import { Agreement } from "@/services/agreementService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Trash2, Pencil } from "lucide-react";
import { formatCurrency, formatCPF } from "@/lib/formatters";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AgreementsListProps {
  agreements: Agreement[];
  isAdmin: boolean;
  onApprove: (agreement: Agreement) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit?: (agreement: Agreement) => void;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  pending_approval: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  pending_approval: "Aguardando Liberação",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
};

const activeStatuses = ["pending", "pending_approval", "approved"];

const AgreementsList = ({ agreements, isAdmin, onApprove, onReject, onCancel, onEdit }: AgreementsListProps) => {
  const [cancelId, setCancelId] = useState<string | null>(null);

  if (agreements.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum acordo encontrado.</p>;
  }

  return (
    <>
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
              <TableHead className="text-right">Ações</TableHead>
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
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    {/* Admin: Aprovar/Rejeitar */}
                    {isAdmin && (a.status === "pending" || a.status === "pending_approval") && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => onApprove(a)} title="Aprovar">
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onReject(a.id)} title="Rejeitar">
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    )}
                    {/* Editar - visible for active agreements */}
                    {activeStatuses.includes(a.status) && onEdit && (
                      <Button size="sm" variant="ghost" onClick={() => onEdit(a)} title="Editar">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                    {/* Cancelar - visible for active agreements */}
                    {activeStatuses.includes(a.status) && (
                      <Button size="sm" variant="ghost" onClick={() => setCancelId(a.id)} title="Cancelar">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Acordo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este acordo? As parcelas pendentes serão marcadas como <strong>Quebra de Acordo</strong> e não voltarão para "Aguardando Acionamento".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelId) {
                  onCancel(cancelId);
                  setCancelId(null);
                }
              }}
            >
              Sim, cancelar acordo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AgreementsList;
