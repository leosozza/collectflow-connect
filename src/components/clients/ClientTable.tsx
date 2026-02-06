import { Client } from "@/services/clientService";
import { formatCurrency, formatDate, statusColors, statusLabels } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CreditCard } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ClientTableProps {
  clients: Client[];
  loading: boolean;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onPayment: (client: Client) => void;
}

const ClientTable = ({ clients, loading, onEdit, onDelete, onPayment }: ClientTableProps) => {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Nenhum cliente encontrado</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Credor</TableHead>
              <TableHead className="text-center">Parcela</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Quebra</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium text-card-foreground">{client.nome_completo}</TableCell>
                <TableCell className="text-muted-foreground">{client.cpf}</TableCell>
                <TableCell className="text-muted-foreground">{client.credor}</TableCell>
                <TableCell className="text-center">{client.numero_parcela}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(client.valor_parcela))}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(client.valor_pago))}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number(client.quebra))}
                </TableCell>
                <TableCell>{formatDate(client.data_vencimento)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[client.status]}`}>
                    {statusLabels[client.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {client.status === "pendente" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-success hover:text-success"
                        onClick={() => onPayment(client)}
                        title="Registrar Pagamento"
                      >
                        <CreditCard className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => onEdit(client)}
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deseja remover o registro de {client.nome_completo} (Parcela {client.numero_parcela})?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(client.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ClientTable;
