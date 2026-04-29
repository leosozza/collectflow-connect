import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { supabase } from "@/integrations/supabase/client";
import { useUrlState } from "@/hooks/useUrlState";
import { useAuth } from "@/hooks/useAuth";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { fetchAgreements, fetchAgreementOperators, approveAgreement, rejectAgreement, cancelAgreement, Agreement } from "@/services/agreementService";
import AgreementsList from "@/components/acordos/AgreementsList";
import PaymentConfirmationTab from "@/components/acordos/PaymentConfirmationTab";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, HandCoins, CalendarIcon } from "lucide-react";
import { exportToExcel } from "@/lib/exportUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getInstallmentsForMonth,
  classifyInstallment,
  buildInstallmentSchedule,
  countPaidInstallments,
  type CobrancaRecord,
  type ManualPaymentRecord,
  type InstallmentClassification,
} from "@/lib/agreementInstallmentClassifier";

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
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useUrlState("status", "vigentes") as [StatusFilter, (val: string) => void];
  const [credorFilter, setCredorFilter] = useUrlState("credor", "todos");
  const [operatorFilter, setOperatorFilter] = useUrlState("operator", "todos");
  const [searchQuery, setSearchQuery] = useUrlState("q", "");
  // Default "todos" para operadores não verem tela vazia quando não há parcela no mês corrente.
  const [selectedMonth, setSelectedMonth] = useUrlState("month", "todos");
  const [selectedYear, setSelectedYear] = useUrlState("year", String(new Date().getFullYear()));
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const isAdmin = permissions.canApproveAcordos;

  // Auto-expire runs in background once per page mount — does NOT block initial render.
  useEffect(() => {
    supabase.functions.invoke("auto-expire-agreements").catch(() => { });
  }, []);

  // Resolve effective created_by filter (server-side):
  // - non-admins: locked to their own user
  // - admins: respect the operator dropdown ("todos" | <user_id> | "portal")
  const effectiveCreatedBy: string | undefined = !isAdmin
    ? user?.id
    : operatorFilter !== "todos" && operatorFilter !== "portal"
      ? operatorFilter
      : undefined;

  // Heavy historical noise (cancelled/rejected) is excluded unless the user
  // explicitly opens the "Cancelados" tab.
  const excludeFinal = statusFilter !== "cancelled";

  const { data: agreements = [], isLoading: loading, refetch } = useQuery({
    queryKey: [
      "agreements-list",
      tenant?.id,
      effectiveCreatedBy ?? "all",
      excludeFinal,
    ],
    queryFn: () => fetchAgreements(tenant?.id || "", {
      created_by: effectiveCreatedBy,
      excludeFinal,
    }),
    enabled: !!tenant?.id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  // Operators list (admins only) — cached aggressively, rarely changes.
  const { data: operators = [] } = useQuery({
    queryKey: ["agreement-operators", tenant?.id],
    queryFn: () => fetchAgreementOperators(tenant?.id || ""),
    enabled: !!tenant?.id && isAdmin,
    staleTime: 5 * 60_000,
  });

  // Agreement IDs visible in the current dataset — used to scope payment lookups.
  const visibleIds = useMemo(() => agreements.map(a => a.id), [agreements]);

  const { data: paymentData = { cobrancas: [] as CobrancaRecord[], manualPayments: [] as ManualPaymentRecord[] } } = useQuery({
    queryKey: ["agreements-payment-data", tenant?.id, visibleIds.length, visibleIds[0] ?? "", visibleIds[visibleIds.length - 1] ?? ""],
    queryFn: async () => {
      if (visibleIds.length === 0) return { cobrancas: [], manualPayments: [] };
      const [cobRes, mpRes] = await Promise.all([
        supabase
          .from("negociarie_cobrancas" as any)
          .select("agreement_id, installment_key, status, valor_pago")
          .in("agreement_id", visibleIds),
        supabase
          .from("manual_payments" as any)
          .select("agreement_id, installment_number, installment_key, amount_paid, status")
          .in("agreement_id", visibleIds),
      ]);
      return {
        cobrancas: ((cobRes.data || []) as unknown) as CobrancaRecord[],
        manualPayments: ((mpRes.data || []) as unknown) as ManualPaymentRecord[],
      };
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const cobrancas = paymentData.cobrancas;
  const manualPayments = paymentData.manualPayments;

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["agreements-list"] });
    queryClient.invalidateQueries({ queryKey: ["agreements-payment-data"] });
  };

  const handleApprove = async (agreement: Agreement) => {
    if (!user || !profile) return;
    try {
      await approveAgreement(agreement, user.id, profile.id);
      trackAction("aprovar_acordo", { acordo_id: agreement.id });
      toast({ title: "Acordo aprovado! Parcelas geradas." });
      reload();
    } catch (err: any) {
      toast({ title: "Erro ao aprovar", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    if (!user) return;
    await rejectAgreement(id, user.id);
    toast({ title: "Acordo rejeitado." });
    reload();
  };

  const handleCancel = async (id: string) => {
    await cancelAgreement(id);
    toast({ title: "Acordo cancelado. Parcelas marcadas como quebra." });
    reload();
  };

  const handleBreak = async (id: string) => {
    await cancelAgreement(id);
    trackAction("quebrar_acordo", { acordo_id: id });
    toast({ title: "Acordo quebrado com sucesso." });
    reload();
  };

  const credores = useMemo(() => {
    const set = new Set(agreements.map(a => a.credor));
    return Array.from(set).sort();
  }, [agreements]);

  const years = useMemo(() => {
    const ySet = new Set<number>();
    agreements.forEach(a => {
      ySet.add(new Date(a.created_at).getFullYear());
      ySet.add(new Date(a.first_due_date + "T00:00:00").getFullYear());
    });
    return Array.from(ySet).sort((a, b) => b - a);
  }, [agreements]);

  const months = [
    { value: "todos", label: "Todos os Meses" },
    ...Array.from({ length: 12 }, (_, i) => ({
      value: String(i),
      label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()),
    })),
  ];

  // Classify agreements by installment status for the selected month
  const classifiedAgreements = useMemo(() => {
    const isMonthSelected = selectedMonth !== "todos" && !dateFrom && !dateTo;
    const today = new Date();
    const m = isMonthSelected ? parseInt(selectedMonth) : -1;
    const y = parseInt(selectedYear);

    type ClassifiedAgreement = Agreement & {
      _installmentClass?: InstallmentClassification;
      _hasPaidInScope?: boolean;
      _paidCount?: number;
      _totalCount?: number;
      _installmentNumber?: number;
      _installmentKey?: string;
      _installmentDueDate?: Date;
      _installmentValue?: number;
    };

    const result: ClassifiedAgreement[] = [];

    for (const agreement of agreements) {
      // Apply credor filter (server already filters; kept as safety)
      if (credorFilter !== "todos" && agreement.credor !== credorFilter) continue;

      // Apply operator filter — "portal" is a pseudo-operator (created_by null + portal_origin true)
      if (operatorFilter === "portal" && !(agreement as any).portal_origin) continue;

      // Apply search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!agreement.client_name.toLowerCase().includes(q) && !agreement.client_cpf.toLowerCase().includes(q)) continue;
      }

      // Compute paid/total counts (full schedule) — used for the new "Parcelas Pagas" column
      const { paid: paidCount, total: totalCount } = countPaidInstallments(
        agreement,
        cobrancas,
        manualPayments,
        today
      );

      // For global statuses (cancelled, pending_approval), no installment logic needed
      if (agreement.status === "cancelled" || agreement.status === "rejected") {
        result.push({ ...agreement, _installmentClass: undefined, _paidCount: paidCount, _totalCount: totalCount });
        continue;
      }
      if (agreement.status === "pending_approval") {
        result.push({ ...agreement, _installmentClass: undefined, _paidCount: paidCount, _totalCount: totalCount });
        continue;
      }

      if (isMonthSelected) {
        // Get installments for this month
        const installments = getInstallmentsForMonth(agreement, m, y);
        if (installments.length === 0) continue; // No installment in this month

        // SPLIT: emit one row per installment in the selected month
        for (const inst of installments) {
          const cls = classifyInstallment(inst, cobrancas, manualPayments, today);
          result.push({
            ...agreement,
            _installmentClass: cls,
            _hasPaidInScope: cls === "pago",
            _paidCount: paidCount,
            _totalCount: totalCount,
            _installmentNumber: inst.number,
            _installmentKey: inst.key,
            _installmentDueDate: inst.dueDate,
            _installmentValue: inst.value,
          });
        }
      } else {
        // Date range or "todos" — filter by due date range if applicable
        let scopedHasPaid = paidCount > 0;
        if (dateFrom || dateTo) {
          const schedule = buildInstallmentSchedule(agreement);
          const inRange = schedule.filter((inst: any) => {
            const d = inst.dueDate;
            if (dateFrom && d < dateFrom) return false;
            if (dateTo) {
              const end = new Date(dateTo);
              end.setHours(23, 59, 59, 999);
              if (d > end) return false;
            }
            return true;
          });
          if (inRange.length === 0) continue;
          scopedHasPaid = inRange.some(inst =>
            classifyInstallment(inst, cobrancas, manualPayments, today) === "pago"
          );
        } else if (selectedYear) {
          // "todos os meses" but year selected — show agreements with installments in that year
          const schedule = buildInstallmentSchedule(agreement);
          const inYear = schedule.filter((inst: any) => inst.dueDate.getFullYear() === y);
          if (inYear.length === 0) continue;
          scopedHasPaid = inYear.some(inst =>
            classifyInstallment(inst, cobrancas, manualPayments, today) === "pago"
          );
        }

        // Use global status mapping
        result.push({ ...agreement, _installmentClass: undefined, _hasPaidInScope: scopedHasPaid, _paidCount: paidCount, _totalCount: totalCount });
      }
    }

    return result;
  }, [agreements, cobrancas, manualPayments, credorFilter, operatorFilter, searchQuery, selectedMonth, selectedYear, dateFrom, dateTo]);

  // Filter by selected tab
  const filteredAgreements = useMemo(() => {
    const isMonthSelected = selectedMonth !== "todos" && !dateFrom && !dateTo;

    return classifiedAgreements.filter(a => {
      const cls = (a as any)._installmentClass as InstallmentClassification | undefined;

      switch (statusFilter) {
        case "vigentes":
          if (isMonthSelected && cls !== undefined) return cls === "vigente";
          return a.status === "pending";
        case "approved": {
          // No modo mês, considera apenas a parcela classificada como "pago".
          if (isMonthSelected && cls !== undefined) return cls === "pago";
          // Fora do modo mês: usa status global ou flag de pagamento no escopo.
          const hasPaid = (a as any)._hasPaidInScope as boolean | undefined;
          return hasPaid === true || a.status === "approved" || a.status === "completed";
        }
        case "overdue":
          if (isMonthSelected && cls !== undefined) return cls === "vencido";
          return a.status === "overdue";
        case "pending_approval":
          return a.status === "pending_approval";
        case "cancelled":
          return a.status === "cancelled";
        case "payment_confirmation":
          if (isMonthSelected && cls !== undefined) return cls === "pending_confirmation";
          return false; // handled by PaymentConfirmationTab
        default:
          return false;
      }
    });
  }, [classifiedAgreements, statusFilter, selectedMonth, dateFrom, dateTo]);

  // Stats based on classified data for selected month
  const stats = useMemo(() => {
    const isMonthSelected = selectedMonth !== "todos" && !dateFrom && !dateTo;
    const relevant = classifiedAgreements.filter(a => a.status !== "cancelled" && a.status !== "rejected");

    const total = relevant.length;
    const pending = isMonthSelected
      ? relevant.filter(a => {
        const c = (a as any)._installmentClass as InstallmentClassification | undefined;
        return c === "vigente" || c === "pending_confirmation";
      }).length
      : relevant.filter(a => a.status === "pending" || a.status === "pending_approval").length;
    // Inclusive paid: agreements with at least one paid installment in scope OR fully approved
    const paid = relevant.filter(a => (a as any)._hasPaidInScope === true || a.status === "approved").length;
    return { total, pending, paid };
  }, [classifiedAgreements, selectedMonth, dateFrom, dateTo]);

  const isOperationalFilter = statusFilter === "pending_approval" || statusFilter === "payment_confirmation";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão de Acordos</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de Acordos" value={String(stats.total)} icon="agreement" />
        <StatCard title="Pendentes" value={String(stats.pending)} icon="receivable" />
        <StatCard title="Pagos" value={String(stats.paid)} icon="received" />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilterConfig
          .filter(({ key }) => key !== "payment_confirmation" || isAdmin)
          .map(({ key, label, color, selectedColor }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${statusFilter === key ? selectedColor : color
                }`}
            >
              {key === "payment_confirmation" && <HandCoins className="w-3 h-3 mr-1" />}
              {label}
            </button>
          ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
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

        {isAdmin && (
          <Select value={operatorFilter} onValueChange={setOperatorFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Operadores</SelectItem>
              {operators.map((op) => (
                <SelectItem
                  key={op.user_id ?? "portal"}
                  value={op.user_id ?? "portal"}
                >
                  {op.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setDateFrom(undefined); setDateTo(undefined); }}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setDateFrom(undefined); setDateTo(undefined); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setSelectedMonth("todos"); }} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setSelectedMonth("todos"); }} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            Limpar datas
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
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
        <AgreementsList agreements={filteredAgreements} />
      )}
    </div>
  );
};

export default AcordosPage;
