import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { fetchAgreements, createAgreement, approveAgreement, rejectAgreement, cancelAgreement, updateAgreement, Agreement, AgreementFormData } from "@/services/agreementService";
import AgreementForm from "@/components/acordos/AgreementForm";
import AgreementsList from "@/components/acordos/AgreementsList";
import StatCard from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";

const AcordosPage = () => {
  const { trackAction } = useActivityTracker();
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [editForm, setEditForm] = useState<Partial<AgreementFormData>>({});
  const [editLoading, setEditLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAgreements(statusFilter !== "todos" ? { status: statusFilter } : undefined);
      setAgreements(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleCreate = async (data: AgreementFormData) => {
    if (!user || !tenant) return;
    await createAgreement(data, user.id, tenant.id);
    trackAction("criar_acordo", { cpf: data.client_cpf, valor: data.proposed_total });
    toast({ title: "Proposta criada com sucesso" });
    load();
  };

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
      notes: agreement.notes || "",
    });
  };

  const handleEditProposed = (proposed: number) => {
    const installments = editForm.new_installments || 1;
    setEditForm({ ...editForm, proposed_total: proposed, new_installment_value: proposed / installments });
  };

  const handleEditInstallments = (n: number) => {
    const proposed = editForm.proposed_total || 0;
    setEditForm({ ...editForm, new_installments: n, new_installment_value: n > 0 ? proposed / n : proposed });
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

  // Exclude cancelled and rejected from metrics
  const activeAgreements = agreements.filter(a => a.status !== "cancelled" && a.status !== "rejected");
  const pending = activeAgreements.filter(a => a.status === "pending").length;
  const approved = activeAgreements.filter(a => a.status === "approved");
  const totalRenegociado = approved.reduce((s, a) => s + a.proposed_total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Acordos</h1>
        <AgreementForm onSubmit={handleCreate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total de Acordos" value={String(activeAgreements.length)} icon="projected" />
        <StatCard title="Pendentes" value={String(pending)} icon="receivable" />
        <StatCard title="Aprovados" value={String(approved.length)} icon="received" />
        <StatCard title="Valor Renegociado" value={formatCurrency(totalRenegociado)} icon="commission" />
      </div>

      <div className="flex gap-4 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="pending_approval">Aguardando Liberação</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="rejected">Rejeitado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <AgreementsList
          agreements={agreements}
          isAdmin={permissions.canApproveAcordos}
          onApprove={handleApprove}
          onReject={handleReject}
          onCancel={handleCancel}
          onEdit={handleEditOpen}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingAgreement} onOpenChange={(open) => !open && setEditingAgreement(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Acordo</DialogTitle>
          </DialogHeader>
          {editingAgreement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <Input disabled value={editingAgreement.client_name} />
                </div>
                <div>
                  <Label>Credor</Label>
                  <Input disabled value={editingAgreement.credor} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Original (R$)</Label>
                  <Input disabled value={editingAgreement.original_total.toFixed(2)} />
                </div>
                <div>
                  <Label>Valor Proposto (R$)</Label>
                  <CurrencyInput value={editForm.proposed_total || 0} onValueChange={handleEditProposed} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nº Parcelas</Label>
                  <Input type="number" min="1" value={editForm.new_installments || 1} onChange={e => handleEditInstallments(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Valor Parcela (R$)</Label>
                  <Input type="number" disabled value={(editForm.new_installment_value || 0).toFixed(2)} />
                </div>
              </div>
              <div>
                <Label>Primeiro Vencimento</Label>
                <Input type="date" value={editForm.first_due_date || ""} onChange={e => setEditForm({ ...editForm, first_due_date: e.target.value })} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
              </div>
              <Button className="w-full" onClick={handleEditSubmit} disabled={editLoading}>
                {editLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcordosPage;
