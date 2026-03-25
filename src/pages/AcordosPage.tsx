import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUrlState } from "@/hooks/useUrlState";
import { useAuth } from "@/hooks/useAuth";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { fetchAgreements, approveAgreement, rejectAgreement, cancelAgreement, updateAgreement, Agreement } from "@/services/agreementService";
import AgreementsList from "@/components/acordos/AgreementsList";
import AgreementInstallments from "@/components/client-detail/AgreementInstallments";
import PaymentConfirmationTab from "@/components/acordos/PaymentConfirmationTab";
import StatCard from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Download, HandCoins } from "lucide-react";
import { exportToExcel } from "@/lib/exportUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusFilter = "vigentes" | "approved" | "overdue" | "pending_approval" | "cancelled" | "payment_confirmation";

const statusFilterConfig: { key: StatusFilter; label: string; color: string; selectedColor: string; icon?: any }[] = [
  { key: "approved", label: "Pagos", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "vigentes", label: "Vigentes", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "overdue", label: "Vencidos", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "pending_approval", label: "Aguardando Liberação", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "cancelled", label: "Cancelados", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "payment_confirmation", label: "Confirmação de Pagamento", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
];

const AcordosPage = () => {
  const { trackAction } = useActivityTracker();
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useUrlState("status", "vigentes") as [StatusFilter, (val: string) => void];
  const [credorFilter, setCredorFilter] = useUrlState("credor", "todos");
  const [searchQuery, setSearchQuery] = useUrlState("q", "");
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [editForm, setEditForm] = useState<Partial<{ proposed_total: number; new_installments: number; new_installment_value: number; first_due_date: string; entrada_value: number; entrada_date: string; notes: string }>>({});
  const [editLoading, setEditLoading] = useState(false);

  const isAdmin = permissions.canApproveAcordos;

  const load = async () => {
    setLoading(true);
    try {
      // Trigger auto-expire check before loading
      try {
        await supabase.functions.invoke("auto-expire-agreements");
      } catch (_) {
        // Non-blocking: if edge function fails, still load agreements
      }
      const filters: { created_by?: string } = {};
      if (!isAdmin && user) filters.created_by = user.id;
      const data = await fetchAgreements(Object.keys(filters).length > 0 ? filters : undefined);
      setAgreements(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [isAdmin, user?.id]);

  const handleApprove = async (agreement: Agreement) => {
    if (!user || !profile) return;
    try {
      await approveAgreement(agreement, user.id, profile.id);
      trackAction("aprovar_acordo", { acordo_id: agreement.id });
      toast({ title: "Acordo aprovado! Parcelas geradas." });
      load();
    } catch (err: any) {
      toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    if (!user) return;
    await rejectAgreement(id, user.id);
    toast({ title: "Acordo rejeitado." });
    load();
  };

  const handleCancel = async (id: string) => {
    await cancelAgreement(id);
    toast({ title: "Acordo cancelado. Parcelas marcadas como quebra." });
    load();
  };

  const handleEditOpen = (agreement: Agreement) => {
    setEditingAgreement(agreement);
    setEditForm({
      proposed_total: agreement.proposed_total,
      new_installments: agreement.new_installments,
      new_installment_value: agreement.new_installment_value,
      first_due_date: agreement.first_due_date,
      entrada_value: agreement.entrada_value || 0,
      entrada_date: agreement.entrada_date || "",
      notes: agreement.notes || "",
    });
  };

  const recalcInstallmentValue = (proposed: number, entrada: number, installments: number) => {
    const remaining = Math.max(proposed - entrada, 0);
    return installments > 0 ? Math.round((remaining / installments) * 100) / 100 : remaining;
  };

  const handleEditProposed = (proposed: number) => {
    const installments = editForm.new_installments || 1;
    const entrada = editForm.entrada_value || 0;
    setEditForm({ ...editForm, proposed_total: proposed, new_installment_value: recalcInstallmentValue(proposed, entrada, installments) });
  };

  const handleEditInstallments = (n: number) => {
    const proposed = editForm.proposed_total || 0;
    const entrada = editForm.entrada_value || 0;
    setEditForm({ ...editForm, new_installments: n, new_installment_value: recalcInstallmentValue(proposed, entrada, n) });
  };

  const handleEditEntrada = (entrada: number) => {
    const proposed = editForm.proposed_total || 0;
    const installments = editForm.new_installments || 1;
    setEditForm({ ...editForm, entrada_value: entrada, new_installment_value: recalcInstallmentValue(proposed, entrada, installments) });
  };

  const handleEditSubmit = async () => {
    if (!editingAgreement) return;
    setEditLoading(true);
    try {
      await updateAgreement(editingAgreement.id, editForm);
      toast({ title: "Acordo atualizado com sucesso." });
      setEditingAgreement(null);
      load();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  // Unique credores list
  const credores = useMemo(() => {
    const set = new Set(agreements.map(a => a.credor));
    return Array.from(set).sort();
  }, [agreements]);

  // Filtered agreements
  const filteredAgreements = useMemo(() => {
    let list = agreements;

    // Status filter
    if (statusFilter === "vigentes") {
      list = list.filter(a => a.status === "pending");
    } else {
      list = list.filter(a => a.status === statusFilter);
    }

    if (credorFilter !== "todos") list = list.filter(a => a.credor === credorFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(a => a.client_name.toLowerCase().includes(q) || a.client_cpf.toLowerCase().includes(q));
    }
    return list;
  }, [agreements, statusFilter, credorFilter, searchQuery]);

  // Counts per status for badges
  const statusCounts = useMemo(() => {
    return {};
  }, [agreements]);

  // Total real independente do filtro
  const totalActiveCount = useMemo(() => 
    agreements.filter(a => a.status !== "cancelled" && a.status !== "rejected").length,
    [agreements]
  );

  // Metrics from filtered view
  const activeAgreements = filteredAgreements.filter(a => a.status !== "cancelled" && a.status !== "rejected" && a.status !== "overdue");
  const pending = activeAgreements.filter(a => a.status === "pending" || a.status === "pending_approval").length;
  const paid = activeAgreements.filter(a => a.status === "approved").length;

  const statusLabels: Record<string, string> = { pending: "Vigente", approved: "Pago", overdue: "Vencido", pending_approval: "Aguardando Liberação", cancelled: "Cancelado", rejected: "Rejeitado" };
  const statusColors: Record<string, string> = { pending: "bg-blue-100 text-blue-800", approved: "bg-green-100 text-green-800", overdue: "bg-red-100 text-red-800", pending_approval: "bg-yellow-100 text-yellow-800", cancelled: "bg-muted text-muted-foreground", rejected: "bg-muted text-muted-foreground" };

  const editDialog = (
    <Dialog open={!!editingAgreement} onOpenChange={(open) => !open && setEditingAgreement(null)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle>Editar Acordo</DialogTitle>
            {editingAgreement && (
              <Badge className={statusColors[editingAgreement.status] || "bg-muted"}>
                {statusLabels[editingAgreement.status] || editingAgreement.status}
              </Badge>
            )}
          </div>
        </DialogHeader>
        {editingAgreement && (
          <div className="space-y-5">
            {/* Info do cliente */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{editingAgreement.client_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CPF</span>
                <span className="font-medium">{editingAgreement.client_cpf}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credor</span>
                <span className="font-medium">{editingAgreement.credor}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Criado em</span>
                <span className="font-medium">{new Date(editingAgreement.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>

            {/* Valores */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Valores</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Valor Original</Label>
                  <Input disabled value={`R$ ${editingAgreement.original_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                </div>
                <div>
                  <Label className="text-xs">Desconto</Label>
                  <Input disabled value={`${editingAgreement.discount_percent ?? 0}%`} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Valor do Acordo</Label>
                <CurrencyInput value={editForm.proposed_total || 0} onValueChange={handleEditProposed} />
              </div>
            </div>

            {/* Entrada */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Entrada</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Valor da Entrada</Label>
                  <CurrencyInput value={editForm.entrada_value || 0} onValueChange={handleEditEntrada} />
                </div>
                <div>
                  <Label className="text-xs">Data da Entrada</Label>
                  <Input type="date" value={editForm.entrada_date || ""} onChange={e => setEditForm({ ...editForm, entrada_date: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Parcelamento */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Parcelamento</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Nº de Parcelas</Label>
                  <Input type="number" min="1" value={editForm.new_installments || 1} onChange={e => handleEditInstallments(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Valor da Parcela</Label>
                  <Input disabled value={`R$ ${(editForm.new_installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                </div>
              </div>
              <div>
                <Label className="text-xs">1º Vencimento das Parcelas</Label>
                <Input type="date" value={editForm.first_due_date || ""} onChange={e => setEditForm({ ...editForm, first_due_date: e.target.value })} />
              </div>
              {/* Resumo visual */}
              <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground text-center">
                {(editForm.entrada_value || 0) > 0
                  ? `Entrada R$ ${(editForm.entrada_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} + ${editForm.new_installments || 1}x R$ ${(editForm.new_installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : `${editForm.new_installments || 1}x R$ ${(editForm.new_installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                }
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
            </div>

            {/* Parcelas e Boletos */}
            <AgreementInstallments agreementId={editingAgreement.id} agreement={editingAgreement} cpf={editingAgreement.client_cpf} tenantId={tenant?.id} onRefresh={load} />

            <Button className="w-full" onClick={handleEditSubmit} disabled={editLoading}>
              {editLoading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão de Acordos</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de Acordos" value={String(totalActiveCount)} icon="agreement" />
        <StatCard title="Pendentes" value={String(pending)} icon="receivable" />
        <StatCard title="Pagos" value={String(paid)} icon="received" />
      </div>

      {/* Status filter badges */}
      <div className="flex flex-wrap gap-2">
        {statusFilterConfig
          .filter(({ key }) => key !== "payment_confirmation" || isAdmin)
          .map(({ key, label, color, selectedColor }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === key ? selectedColor : color
            }`}
          >
            {key === "payment_confirmation" && <HandCoins className="w-3 h-3 mr-1" />}
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <Select value={credorFilter} onValueChange={setCredorFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar credor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Credores</SelectItem>
            {credores.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const rows = filteredAgreements.map((a) => ({
              Cliente: a.client_name,
              CPF: a.client_cpf,
              Credor: a.credor,
              "Valor Original": a.original_total,
              "Valor Proposto": a.proposed_total,
              "Desconto %": a.discount_percent ?? 0,
              Parcelas: a.new_installments,
              "Valor Parcela": a.new_installment_value,
              "1º Vencimento": a.first_due_date,
              Status: a.status,
              "Data Criação": a.created_at,
            }));
            exportToExcel(rows, "Acordos", "acordos_exportacao");
          }}
        >
          <Download className="w-4 h-4 mr-1" /> Excel
        </Button>
      </div>

      {statusFilter === "payment_confirmation" ? (
        tenant?.id ? <PaymentConfirmationTab tenantId={tenant.id} /> : <p className="text-muted-foreground">Carregando...</p>
      ) : loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <AgreementsList
          agreements={filteredAgreements}
          isAdmin={isAdmin}
          onApprove={handleApprove}
          onReject={handleReject}
          onCancel={handleCancel}
          onEdit={handleEditOpen}
        />
      )}

      {editDialog}
    </div>
  );
};

export default AcordosPage;
