import { useState } from "react";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchClients,
  createClient,
  updateClient,
  deleteClient,
  markAsPaid,
  bulkCreateClients,
  Client,
  ClientFormData,
} from "@/services/clientService";
import type { ImportedRow } from "@/services/importService";
import ClientTable from "@/components/clients/ClientTable";
import ClientForm from "@/components/clients/ClientForm";
import ClientFilters from "@/components/clients/ClientFilters";
import PaymentDialog from "@/components/clients/PaymentDialog";
import ImportDialog from "@/components/clients/ImportDialog";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ClientsPage = () => {
  const { profile } = useAuth();
  const { trackAction } = useActivityTracker();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: "todos",
    credor: "todos",
    dateFrom: "",
    dateTo: "",
    search: "",
    tipoDevedorId: "",
    tipoDividaId: "",
    statusCobrancaId: "",
    semAcordo: false,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", filters],
    queryFn: () => fetchClients(filters),
  });

  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) => createClient(data, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      trackAction("cadastrar_cliente");
      toast.success("Cliente cadastrado!");
      setFormOpen(false);
    },
    onError: () => toast.error("Erro ao cadastrar cliente"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientFormData> }) =>
      updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      trackAction("atualizar_cliente");
      toast.success("Cliente atualizado!");
      setFormOpen(false);
      setEditingClient(null);
    },
    onError: () => toast.error("Erro ao atualizar cliente"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido!");
    },
    onError: () => toast.error("Erro ao remover cliente"),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ client, valor }: { client: Client; valor: number }) =>
      markAsPaid(client, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      trackAction("registrar_pagamento");
      toast.success("Pagamento registrado e próxima parcela criada!");
      setPaymentClient(null);
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const importMutation = useMutation({
    mutationFn: (rows: ImportedRow[]) => bulkCreateClients(rows, profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Clientes importados com sucesso!");
      setImportOpen(false);
    },
    onError: () => toast.error("Erro ao importar clientes"),
  });

  const handleSubmit = (data: ClientFormData) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingClient(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerencie as parcelas e clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Importar
          </Button>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <ClientFilters filters={filters} onChange={setFilters} />

      <ClientTable
        clients={clients}
        loading={isLoading}
        onEdit={handleEdit}
        onDelete={(id) => deleteMutation.mutate(id)}
        onPayment={setPaymentClient}
      />

      <Dialog open={formOpen} onOpenChange={handleCloseForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <ClientForm
            defaultValues={editingClient || undefined}
            onSubmit={handleSubmit}
            submitting={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <PaymentDialog
        client={paymentClient}
        onClose={() => setPaymentClient(null)}
        onConfirm={(valor) => {
          if (paymentClient) {
            paymentMutation.mutate({ client: paymentClient, valor });
          }
        }}
        submitting={paymentMutation.isPending}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onConfirm={(rows) => importMutation.mutate(rows)}
        submitting={importMutation.isPending}
      />
    </div>
  );
};

export default ClientsPage;
