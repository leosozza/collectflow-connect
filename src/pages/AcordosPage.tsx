import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { fetchAgreements, approveAgreement, rejectAgreement, cancelAgreement, updateAgreement, Agreement } from "@/services/agreementService";
import AgreementsList from "@/components/acordos/AgreementsList";
import StatCard from "@/components/StatCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Download } from "lucide-react";
import { exportToExcel } from "@/lib/exportUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusFilter = "vigentes" | "approved" | "overdue" | "pending_approval" | "cancelled";

const statusFilterConfig: { key: StatusFilter; label: string; color: string; selectedColor: string }[] = [
  { key: "approved", label: "Pagos", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "vigentes", label: "Vigentes", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "overdue", label: "Vencidos", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "pending_approval", label: "Aguardando Liberação", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "cancelled", label: "Cancelados", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
];

const AcordosPage = () => {
  const { trackAction } = useActivityTracker();
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const permissions = usePermissions();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("vigentes");
  const [credorFilter, setCredorFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [editForm, setEditForm] = useState<Partial<{ proposed_total: number; new_installments: number; new_installment_value: number; first_due_date: string; notes: string }>>({});
  const [editLoading, setEditLoading] = useState(false);

  const isAdmin = permissions.canApproveAcordos;

  const load = async () => {
    setLoading(true);
    try {
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

  // Metrics (exclude cancelled/rejected/overdue)
  const activeAgreements = filteredAgreements.filter(a => a.status !== "cancelled" && a.status !== "rejected" && a.status !== "overdue");
  const pending = activeAgreements.filter(a => a.status === "pending" || a.status === "pending_approval").length;
  const paid = activeAgreements.filter(a => a.status === "approved").length;

  const editDialog = (
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
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão de Acordos</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de Acordos" value={String(activeAgreements.length)} icon="agreement" />
        <StatCard title="Pendentes" value={String(pending)} icon="receivable" />
        <StatCard title="Pagos" value={String(paid)} icon="received" />
      </div>

      {/* Status filter badges */}
      <div className="flex flex-wrap gap-2">
        {statusFilterConfig.map(({ key, label, color, selectedColor }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              statusFilter === key ? selectedColor : color
            }`}
          >
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

      {loading ? (
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
