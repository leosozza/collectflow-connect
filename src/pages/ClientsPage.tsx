import { useState, useMemo } from "react";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useUrlState } from "@/hooks/useUrlState";
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
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import ClientTable from "@/components/clients/ClientTable";
import ClientForm from "@/components/clients/ClientForm";
import ClientFilters from "@/components/clients/ClientFilters";
import PaymentDialog from "@/components/clients/PaymentDialog";
import ImportDialog from "@/components/clients/ImportDialog";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useGamificationTrigger } from "@/hooks/useGamificationTrigger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ClientsPage = () => {
  useScrollRestore();
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const { trackAction } = useActivityTracker();
  const queryClient = useQueryClient();
  const { triggerGamificationUpdate } = useGamificationTrigger();
  // URL-synced filters
  const [urlStatus, setUrlStatus] = useUrlState("status", "todos");
  const [urlCredor, setUrlCredor] = useUrlState("credor", "todos");
  const [urlDateFrom, setUrlDateFrom] = useUrlState("dateFrom", "");
  const [urlDateTo, setUrlDateTo] = useUrlState("dateTo", "");
  const [urlSearch, setUrlSearch] = useUrlState("search", "");
  const [urlTipoDevedorId, setUrlTipoDevedorId] = useUrlState("tipoDevedorId", "");
  const [urlTipoDividaId, setUrlTipoDividaId] = useUrlState("tipoDividaId", "");
  const [urlStatusCobrancaId, setUrlStatusCobrancaId] = useUrlState("statusCobrancaId", "");
  const [urlSemAcordo, setUrlSemAcordo] = useUrlState("semAcordo", false);
  const [urlCadastroDe, setUrlCadastroDe] = useUrlState("cadastroDe", "");
  const [urlCadastroAte, setUrlCadastroAte] = useUrlState("cadastroAte", "");
  const [urlQuitados, setUrlQuitados] = useUrlState("quitados", false);
  const [urlValorAbertoDe, setUrlValorAbertoDe] = useUrlState("valorAbertoDe", 0);
  const [urlValorAbertoAte, setUrlValorAbertoAte] = useUrlState("valorAbertoAte", 0);
  const [urlSemContato, setUrlSemContato] = useUrlState("semContato", false);
  const [urlEmDia, setUrlEmDia] = useUrlState("emDia", false);
  const [urlHigienizados, setUrlHigienizados] = useUrlState("higienizados", false);
  const [urlScoreRange, setUrlScoreRange] = useUrlState("scoreRange", "");
  const [urlDebtorProfile, setUrlDebtorProfile] = useUrlState("debtorProfile", "");

  const filters = useMemo(() => ({
    status: urlStatus,
    credor: urlCredor,
    dateFrom: urlDateFrom,
    dateTo: urlDateTo,
    search: urlSearch,
    tipoDevedorId: urlTipoDevedorId,
    tipoDividaId: urlTipoDividaId,
    statusCobrancaId: urlStatusCobrancaId,
    semAcordo: urlSemAcordo,
    cadastroDe: urlCadastroDe,
    cadastroAte: urlCadastroAte,
    quitados: urlQuitados,
    valorAbertoDe: urlValorAbertoDe,
    valorAbertoAte: urlValorAbertoAte,
    semContato: urlSemContato,
    emDia: urlEmDia,
    higienizados: urlHigienizados,
    semWhatsapp: false,
    scoreRange: urlScoreRange,
    debtorProfile: urlDebtorProfile,
  }), [urlStatus, urlCredor, urlDateFrom, urlDateTo, urlSearch, urlTipoDevedorId, urlTipoDividaId, urlStatusCobrancaId, urlSemAcordo, urlCadastroDe, urlCadastroAte, urlQuitados, urlValorAbertoDe, urlValorAbertoAte, urlSemContato, urlEmDia, urlHigienizados, urlScoreRange, urlDebtorProfile]);

  const setFilters = useMemo(() => {
    return (newFilters: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
      const resolved = typeof newFilters === 'function' ? newFilters(filters) : newFilters;
      setUrlStatus(resolved.status);
      setUrlCredor(resolved.credor);
      setUrlDateFrom(resolved.dateFrom);
      setUrlDateTo(resolved.dateTo);
      setUrlSearch(resolved.search);
      setUrlTipoDevedorId(resolved.tipoDevedorId);
      setUrlTipoDividaId(resolved.tipoDividaId);
      setUrlStatusCobrancaId(resolved.statusCobrancaId);
      setUrlSemAcordo(resolved.semAcordo);
      setUrlCadastroDe(resolved.cadastroDe);
      setUrlCadastroAte(resolved.cadastroAte);
      setUrlQuitados(resolved.quitados);
      setUrlValorAbertoDe(resolved.valorAbertoDe);
      setUrlValorAbertoAte(resolved.valorAbertoAte);
      setUrlSemContato(resolved.semContato);
      setUrlEmDia(resolved.emDia);
      setUrlHigienizados(resolved.higienizados);
      setUrlScoreRange(resolved.scoreRange);
      setUrlDebtorProfile(resolved.debtorProfile);
    };
  }, [filters, setUrlStatus, setUrlCredor, setUrlDateFrom, setUrlDateTo, setUrlSearch, setUrlTipoDevedorId, setUrlTipoDividaId, setUrlStatusCobrancaId, setUrlSemAcordo, setUrlCadastroDe, setUrlCadastroAte, setUrlQuitados, setUrlValorAbertoDe, setUrlValorAbertoAte, setUrlSemContato, setUrlEmDia, setUrlHigienizados, setUrlScoreRange, setUrlDebtorProfile]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: clientsResult = { data: [], count: 0 }, isLoading } = useQuery({
    queryKey: ["clients", tenant?.id, filters],
    queryFn: () => fetchClients(tenant!.id, filters),
    enabled: !!tenant?.id,
  });
  const clients = clientsResult.data;




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
      triggerGamificationUpdate();
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const importMutation = useMutation({
    mutationFn: (rows: ImportedRow[]) => {
      return bulkCreateClients(rows, profile!.id);
    },
    onSuccess: async () => {
      // Run auto-status-sync to derive statuses automatically
      await supabase.functions.invoke("auto-status-sync", { body: { tenant_id: tenant?.id } });
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
  const displayClients = clients;

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
        clients={displayClients}
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
