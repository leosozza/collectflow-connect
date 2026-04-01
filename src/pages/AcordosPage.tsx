import { useState, useEffect, useMemo } from "react";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { supabase } from "@/integrations/supabase/client";
import { useUrlState } from "@/hooks/useUrlState";
import { useAuth } from "@/hooks/useAuth";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { fetchAgreements, approveAgreement, rejectAgreement, cancelAgreement, Agreement } from "@/services/agreementService";
import AgreementsList from "@/components/acordos/AgreementsList";
import PaymentConfirmationTab from "@/components/acordos/PaymentConfirmationTab";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Download, HandCoins } from "lucide-react";
import { exportToExcel } from "@/lib/exportUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StatusFilter = "vigentes" | "approved" | "overdue" | "pending_approval" | "cancelled" | "payment_confirmation";

const statusFilterConfig: { key: StatusFilter; label: string; color: string; selectedColor: string }[] = [
  { key: "approved", label: "Pagos", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "vigentes", label: "Vigentes", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "overdue", label: "Vencidos", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "pending_approval", label: "Aguardando Liberação", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "cancelled", label: "Cancelados", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
  { key: "payment_confirmation", label: "Confirmação de Pagamento", color: "bg-muted text-muted-foreground", selectedColor: "bg-primary text-primary-foreground ring-2 ring-primary shadow-sm" },
];

const AcordosPage = () => {
  useScrollRestore();
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

  const isAdmin = permissions.canApproveAcordos;

  const load = async () => {
    setLoading(true);
    try {
      try {
        await supabase.functions.invoke("auto-expire-agreements");
      } catch (_) {}
      const filters: { created_by?: string } = {};
      if (!isAdmin && user) filters.created_by = user.id;
      const data = await fetchAgreements(tenant?.id || "", Object.keys(filters).length > 0 ? filters : undefined);
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

  const credores = useMemo(() => {
    const set = new Set(agreements.map(a => a.credor));
    return Array.from(set).sort();
  }, [agreements]);

  const filteredAgreements = useMemo(() => {
    let list = agreements;
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

  const totalActiveCount = useMemo(() =>
    agreements.filter(a => a.status !== "cancelled" && a.status !== "rejected").length,
    [agreements]
  );

  const activeAgreements = filteredAgreements.filter(a => a.status !== "cancelled" && a.status !== "rejected" && a.status !== "overdue");
  const pending = activeAgreements.filter(a => a.status === "pending" || a.status === "pending_approval").length;
  const paid = activeAgreements.filter(a => a.status === "approved").length;

  // Determine which statuses allow admin actions in /acordos
  const isOperationalFilter = statusFilter === "pending_approval" || statusFilter === "payment_confirmation";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão de Acordos</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de Acordos" value={String(totalActiveCount)} icon="agreement" />
        <StatCard title="Pendentes" value={String(pending)} icon="receivable" />
        <StatCard title="Pagos" value={String(paid)} icon="received" />
      </div>

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
          onCancel={isOperationalFilter ? handleCancel : undefined}
          showOperationalActions={isOperationalFilter}
        />
      )}
    </div>
  );
};

export default AcordosPage;
