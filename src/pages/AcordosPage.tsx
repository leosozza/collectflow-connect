import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { fetchAgreements, createAgreement, approveAgreement, rejectAgreement, cancelAgreement, Agreement, AgreementFormData } from "@/services/agreementService";
import AgreementForm from "@/components/acordos/AgreementForm";
import AgreementsList from "@/components/acordos/AgreementsList";
import StatCard from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Handshake } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const AcordosPage = () => {
  const { user, profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");

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
    toast({ title: "Proposta criada com sucesso" });
    load();
  };

  const handleApprove = async (agreement: Agreement) => {
    if (!user || !profile) return;
    try {
      await approveAgreement(agreement, user.id, profile.id);
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
    toast({ title: "Acordo cancelado." });
    load();
  };

  const pending = agreements.filter(a => a.status === "pending").length;
  const approved = agreements.filter(a => a.status === "approved");
  const totalRenegociado = approved.reduce((s, a) => s + a.proposed_total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestão de Acordos</h1>
        <AgreementForm onSubmit={handleCreate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total de Acordos" value={String(agreements.length)} icon="projected" />
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
          isAdmin={isTenantAdmin}
          onApprove={handleApprove}
          onReject={handleReject}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default AcordosPage;
