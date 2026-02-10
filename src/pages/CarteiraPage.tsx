import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchClients,
  updateClient,
  markAsPaid,
  Client,
  ClientFormData,
} from "@/services/clientService";
import { formatCurrency, formatDate } from "@/lib/formatters";
import PaymentDialog from "@/components/clients/PaymentDialog";
import ClientFilters from "@/components/clients/ClientFilters";
import { Button } from "@/components/ui/button";
import { Edit, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import ClientForm from "@/components/clients/ClientForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CarteiraPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({
    status: "todos",
    credor: "todos",
    dateFrom: "",
    dateTo: "",
    search: "",
  });
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", filters],
    queryFn: () => fetchClients(filters),
  });

  // Filter by search term (name or CPF) and sort by data_vencimento ascending
  const displayClients = useMemo(() => {
    let filtered = clients;
    if (filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      filtered = clients.filter(
        (c) =>
          c.nome_completo.toLowerCase().includes(term) ||
          c.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, ""))
      );
    }
    return [...filtered].sort(
      (a, b) => a.data_vencimento.localeCompare(b.data_vencimento)
    );
  }, [clients, filters.search]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientFormData> }) =>
      updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente atualizado!");
      setFormOpen(false);
      setEditingClient(null);
    },
    onError: () => toast.error("Erro ao atualizar cliente"),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ client, valor }: { client: Client; valor: number }) =>
      markAsPaid(client, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Pagamento registrado e próxima parcela criada!");
      setPaymentClient(null);
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = (data: ClientFormData) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    }
  };

  const getStatusIcon = (client: Client) => {
    if (client.status === "pago") {
      return <CheckCircle className="w-5 h-5 text-success mx-auto" />;
    }
    if (client.status === "quebrado") {
      return <XCircle className="w-5 h-5 text-destructive mx-auto" />;
    }
    // pendente: yellow only if due date is in the future
    const today = new Date().toISOString().split("T")[0];
    if (client.data_vencimento < today) {
      // overdue pendente = treat as quebrado visually
      return <XCircle className="w-5 h-5 text-destructive mx-auto" />;
    }
    return <Clock className="w-5 h-5 text-warning mx-auto" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carteira</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie as parcelas, pagamentos e clientes
        </p>
      </div>

      <ClientFilters filters={filters} onChange={setFilters} />

      {/* Client table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : displayClients.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum cliente encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Credor</TableHead>
                  <TableHead className="text-center">Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor da Parcela</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-card-foreground">{client.nome_completo}</TableCell>
                    <TableCell className="text-muted-foreground">{client.cpf}</TableCell>
                    <TableCell className="text-muted-foreground">{client.credor}</TableCell>
                    <TableCell className="text-center">{client.numero_parcela}</TableCell>
                    <TableCell>{formatDate(client.data_vencimento)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(client.valor_parcela))}</TableCell>
                    <TableCell className="text-center">
                      {getStatusIcon(client)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {client.status === "pendente" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-success hover:text-success"
                            onClick={() => setPaymentClient(client)}
                            title="Registrar Pagamento"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEdit(client)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={formOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            defaultValues={editingClient || undefined}
            onSubmit={handleSubmit}
            submitting={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <PaymentDialog
        client={paymentClient}
        onClose={() => setPaymentClient(null)}
        onConfirm={(valor, dataRecebimento) => {
          if (paymentClient) {
            paymentMutation.mutate({ client: paymentClient, valor });
          }
        }}
        submitting={paymentMutation.isPending}
      />
    </div>
  );
};

export default CarteiraPage;
