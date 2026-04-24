import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
  Phone,
  FileCheck,
  CalendarCheck,
  Settings2,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { useNavigate } from "react-router-dom";

import { usePermissions } from "@/hooks/usePermissions";
import { useScheduledCallbacks } from "@/hooks/useScheduledCallbacks";
import DashboardMetaCard from "@/components/dashboard/DashboardMetaCard";
import ParcelasProgramadasCard, {
  VencimentoRow,
} from "@/components/dashboard/ParcelasProgramadasCard";
import TotalRecebidoCard from "@/components/dashboard/TotalRecebidoCard";
import AgendamentosHojeCard from "@/components/dashboard/AgendamentosHojeCard";
import CustomizeDashboardDialog from "@/components/dashboard/CustomizeDashboardDialog";
import {
  useDashboardLayout,
  DashboardBlockId,
} from "@/hooks/useDashboardLayout";
import { cn } from "@/lib/utils";

const generateYearOptions = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 3; i++) years.push(now.getFullYear() - i);
  return years;
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface DashboardStats {
  total_projetado: number;
  total_negociado: number;
  total_negociado_mes: number;
  total_recebido: number;
  total_quebra: number;
  total_pendente: number;
  acordos_dia: number;
  acordos_mes: number;
}

const DashboardPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const permissions = usePermissions();
  const { layout, setLayout, reset } = useDashboardLayout();

  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [browseDate, setBrowseDate] = useState(new Date());
  const [scheduledDate] = useState(new Date());
  const { callbacks, canViewAll: canViewAllAgendados } = useScheduledCallbacks(scheduledDate);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const canViewAll = permissions.canViewAllDashboard;

  // Fetch operators for admin filter
  const { data: operators = [] } = useQuery({
    queryKey: ["dashboard-operators", profile?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("user_id, full_name, role")
        .eq("tenant_id", profile!.tenant_id!)
        .neq("role", "admin");
      return (data || []).map(p => ({ value: p.user_id, label: p.full_name || "Sem nome" }));
    },
    enabled: !!profile?.tenant_id && canViewAll,
  });

  // Determine filter params for RPCs
  const rpcUserId = canViewAll
    ? (selectedOperators.length === 1 ? selectedOperators[0] : null)
    : (profile?.user_id ?? null);
  const filterYear = selectedYears.length === 1 ? parseInt(selectedYears[0]) : null;
  const filterMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) + 1 : null;

  // Dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", rpcUserId, filterYear, filterMonth],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (rpcUserId) params._user_id = rpcUserId;
      if (filterYear) params._year = filterYear;
      if (filterMonth) params._month = filterMonth;

      const { data, error } = await supabase.rpc("get_dashboard_stats", params as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as DashboardStats;
    },
  });

  // Acionados hoje
  const { data: acionadosHoje = 0 } = useQuery({
    queryKey: ["acionados-hoje", rpcUserId, profile?.tenant_id],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (rpcUserId) params._user_id = rpcUserId;
      const { data, error } = await supabase.rpc("get_acionados_hoje", params as any);
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!profile?.tenant_id,
    refetchInterval: 60_000,
  });

  // Vencimentos
  const browseDateStr = format(browseDate, "yyyy-MM-dd");
  const { data: vencimentos = [] } = useQuery({
    queryKey: ["dashboard-vencimentos", browseDateStr, rpcUserId],
    queryFn: async () => {
      const params: Record<string, unknown> = { _target_date: browseDateStr };
      if (rpcUserId) params._user_id = rpcUserId;

      const { data, error } = await supabase.rpc("get_dashboard_vencimentos", params as any);
      if (error) throw error;
      return (data || []) as VencimentoRow[];
    },
  });

  const yearOptions = useMemo(
    () => generateYearOptions().map((y) => ({ value: y.toString(), label: y.toString() })),
    []
  );
  const monthOptions = useMemo(
    () => monthNames.map((name, i) => ({ value: i.toString(), label: name })),
    []
  );

  const navigateDate = (dir: number) => {
    setBrowseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir);
      return d;
    });
  };

  // Right column blocks (parcelas is rendered separately on the left)
  const rightBlocks = layout.order.filter(
    (id) => id !== "parcelas" && layout.visible[id as DashboardBlockId]
  );
  const showParcelas = layout.visible.parcelas;

  const renderBlock = (id: DashboardBlockId) => {
    switch (id) {
      case "totalRecebido":
        return (
          <TotalRecebidoCard
            key="totalRecebido"
            totalRecebido={stats?.total_recebido ?? 0}
          />
        );
      case "metas":
        return (
          <DashboardMetaCard
            key="metas"
            year={filterYear ?? now.getFullYear()}
            month={filterMonth ?? now.getMonth() + 1}
            monthLabel={new Date(
              filterYear ?? now.getFullYear(),
              (filterMonth ?? now.getMonth() + 1) - 1,
              1
            ).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
            selectedOperatorUserId={selectedOperators.length === 1 ? selectedOperators[0] : null}
            received={stats?.total_recebido ?? 0}
          />
        );
      case "agendamentos":
        return (
          <AgendamentosHojeCard
            key="agendamentos"
            callbacks={callbacks}
            showOperator={canViewAllAgendados}
          />
        );
      default:
        return null;
    }
  };

  const kpis = [
    {
      label: "Acionados Hoje",
      value: String(acionadosHoje),
      Icon: Phone,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      label: "Acordos do Dia",
      value: String(stats?.acordos_dia ?? 0),
      Icon: FileCheck,
      iconColor: "text-success",
      iconBg: "bg-success/10",
    },
    {
      label: "Acordos do Mês",
      value: String(stats?.acordos_mes ?? 0),
      Icon: CalendarCheck,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
    },
  ];

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Bem-vindo, {profile?.full_name || "Operador"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {permissions.canViewRelatorios && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => navigate("/relatorios")}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 text-xs border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => navigate("/analytics")}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>
          <MultiSelect
            options={yearOptions}
            selected={selectedYears}
            onChange={setSelectedYears}
            allLabel="Ano"
            className="w-[120px]"
          />
          <MultiSelect
            options={monthOptions}
            selected={selectedMonths}
            onChange={setSelectedMonths}
            allLabel="Mês"
            className="w-[130px]"
          />
          {canViewAll && (
            <MultiSelect
              options={operators}
              selected={selectedOperators}
              onChange={setSelectedOperators}
              allLabel="Todos"
              className="w-[160px]"
              searchable
              searchPlaceholder="Buscar operador..."
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setCustomizeOpen(true)}
            title="Personalizar Dashboard"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Personalizar</span>
          </Button>
        </div>
      </div>

      {/* KPI cards row (top) */}
      {layout.visible.kpisTop && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((item) => {
            const ItemIcon = item.Icon;
            return (
              <div
                key={item.label}
                className="bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3 flex flex-col"
              >
                <div className={cn("rounded-lg p-1.5 w-fit", item.iconBg)}>
                  <ItemIcon className={cn("w-4 h-4", item.iconColor)} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{item.label}</p>
                <p className="text-2xl font-bold text-foreground tabular-nums leading-tight">
                  {item.value}
                </p>
              </div>
            );
          })}
          <StatCard
            title="Colchão de Acordos"
            value={formatCurrency(stats?.total_projetado ?? 0)}
            icon="projected"
          />
          <StatCard
            title="Total Negociado no Mês"
            value={formatCurrency(stats?.total_negociado_mes ?? 0)}
            icon="agreement"
          />
          <StatCard
            title="Total de Quebra"
            value={formatCurrency(stats?.total_quebra ?? 0)}
            icon="broken"
          />
          <StatCard
            title="Pendentes"
            value={formatCurrency(stats?.total_pendente ?? 0)}
            icon="receivable"
          />
        </div>
      )}

      {/* Main area: 2 columns (Parcelas large left + stack right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {showParcelas && (
          <div className="lg:col-span-2 flex flex-col">
            <ParcelasProgramadasCard
              vencimentos={vencimentos}
              browseDate={browseDate}
              onNavigateDate={navigateDate}
              onPickDate={setBrowseDate}
            />
          </div>
        )}

        {rightBlocks.length > 0 && (
          <div
            className={cn(
              "flex flex-col gap-4",
              showParcelas ? "lg:col-span-1" : "lg:col-span-3"
            )}
          >
            {rightBlocks.map((id) => renderBlock(id as DashboardBlockId))}
          </div>
        )}
      </div>

      <CustomizeDashboardDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        layout={layout}
        onSave={setLayout}
        onReset={reset}
      />
    </div>
  );
};

export default DashboardPage;
