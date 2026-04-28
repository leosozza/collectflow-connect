import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
  Phone,
  FileCheck,
  CalendarCheck,
  Settings2,
  Handshake,
  TrendingDown,
  Hourglass,
  Wallet,
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
import SortableCard from "@/components/dashboard/SortableCard";
import { DashboardBlockId, useDashboardLayout } from "@/hooks/useDashboardLayout";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

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
  acionados_ontem: number;
  acordos_dia_anterior: number;
  acordos_mes_anterior: number;
  total_negociado_mes_anterior: number;
  total_recebido_mes_anterior: number;
  total_quebra_mes_anterior: number;
  total_pendente_mes_anterior: number;
}

// Calcula variação percentual entre período atual e anterior.
// Retorna { value, isPositive } ou null quando não houver base de comparação.
// `invert=true` para métricas onde queda é positiva (Quebra, Pendentes).
function pctDelta(
  current: number,
  previous: number,
  invert = false
): { value: string; isPositive: boolean } | null {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0 && c === 0) return null;
  if (p === 0) {
    return { value: "+100%", isPositive: !invert };
  }
  const pct = ((c - p) / p) * 100;
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? "+" : "";
  const isUp = rounded >= 0;
  return {
    value: `${sign}${rounded}%`,
    isPositive: invert ? !isUp : isUp,
  };
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
  // - 0 operadores selecionados (canViewAll): null = todos
  // - 1 operador: usa _user_id (compat)
  // - 2+ operadores: usa _user_ids (array)
  const rpcUserIds: string[] | null =
    canViewAll && selectedOperators.length > 1 ? selectedOperators : null;
  const rpcUserId = canViewAll
    ? (selectedOperators.length === 1 ? selectedOperators[0] : null)
    : (profile?.user_id ?? null);
  const rpcUserIdsKey = rpcUserIds ? rpcUserIds.join(",") : null;
  const filterYear = selectedYears.length === 1 ? parseInt(selectedYears[0]) : null;
  const filterMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) + 1 : null;

  // Dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", rpcUserId, rpcUserIdsKey, filterYear, filterMonth],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (rpcUserIds) params._user_ids = rpcUserIds;
      else if (rpcUserId) params._user_id = rpcUserId;
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
    queryKey: ["acionados-hoje", rpcUserId, rpcUserIdsKey, profile?.tenant_id],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (rpcUserIds) params._user_ids = rpcUserIds;
      else if (rpcUserId) params._user_id = rpcUserId;
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
    queryKey: ["dashboard-vencimentos", browseDateStr, rpcUserId, rpcUserIdsKey],
    queryFn: async () => {
      const params: Record<string, unknown> = { _target_date: browseDateStr };
      if (rpcUserIds) params._user_ids = rpcUserIds;
      else if (rpcUserId) params._user_id = rpcUserId;

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

  // Span (Tailwind classes) per block — defines its preferred width on lg+ screens.
  const SPAN_CLASS: Record<DashboardBlockId, string> = {
    kpiAcionadosHoje: "col-span-1 lg:col-span-2",
    kpiAcordosDia: "col-span-1 lg:col-span-2",
    kpiAcordosMes: "col-span-1 lg:col-span-2",
    kpiQuebra: "col-span-1 lg:col-span-2",
    kpiPendentes: "col-span-1 lg:col-span-2",
    kpiColchao: "col-span-1 lg:col-span-2",
    metas: "col-span-1 lg:col-span-3",
    agendamentos: "col-span-1 lg:col-span-3",
    totalRecebido: "col-span-1 lg:col-span-6",
    parcelas: "col-span-1 lg:col-span-6",
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = layout.order.indexOf(active.id as DashboardBlockId);
    const newIndex = layout.order.indexOf(over.id as DashboardBlockId);
    if (oldIndex < 0 || newIndex < 0) return;
    setLayout({ ...layout, order: arrayMove(layout.order, oldIndex, newIndex) });
  };

  const trendAcionados = pctDelta(acionadosHoje, stats?.acionados_ontem ?? 0);
  const trendAcordosDia = pctDelta(stats?.acordos_dia ?? 0, stats?.acordos_dia_anterior ?? 0);
  const trendAcordosMes = pctDelta(stats?.acordos_mes ?? 0, stats?.acordos_mes_anterior ?? 0);
  const trendNegociadoMes = pctDelta(stats?.total_negociado_mes ?? 0, stats?.total_negociado_mes_anterior ?? 0);
  const trendQuebra = pctDelta(stats?.total_quebra ?? 0, stats?.total_quebra_mes_anterior ?? 0, true);
  const trendPendentes = pctDelta(stats?.total_pendente ?? 0, stats?.total_pendente_mes_anterior ?? 0, true);

  const kpis = [
    {
      label: "Acionados Hoje",
      value: String(acionadosHoje),
      Icon: Phone,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-500/10",
      trend: trendAcionados ? { ...trendAcionados, text: "vs ontem" } : undefined,
    },
    {
      label: "Acordos do Dia",
      value: String(stats?.acordos_dia ?? 0),
      Icon: FileText,
      iconColor: "text-green-500",
      iconBg: "bg-green-500/10",
      trend: trendAcordosDia ? { ...trendAcordosDia, text: "vs ontem" } : undefined,
    },
    {
      label: "Acordos do Mês",
      value: String(stats?.acordos_mes ?? 0),
      Icon: CalendarCheck,
      iconColor: "text-blue-500",
      iconBg: "bg-blue-500/10",
      trend: trendAcordosMes ? { ...trendAcordosMes, text: "vs mês anterior" } : undefined,
    },
    {
      label: "Total de Quebra",
      value: formatCurrency(stats?.total_quebra ?? 0),
      Icon: TrendingDown,
      iconColor: "text-red-500",
      iconBg: "bg-red-500/10",
      trend: trendQuebra ? { ...trendQuebra, text: "vs mês anterior" } : undefined,
    },
    {
      label: "Pendentes",
      value: formatCurrency(stats?.total_pendente ?? 0),
      Icon: Hourglass,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/10",
      trend: trendPendentes ? { ...trendPendentes, text: "vs mês anterior" } : undefined,
    },
    {
      label: "Colchão de Acordos",
      value: formatCurrency(stats?.total_projetado ?? 0),
      Icon: Wallet,
      iconColor: "text-indigo-500",
      iconBg: "bg-indigo-500/10",
      trend: undefined as { value: string; text: string; isPositive: boolean } | undefined,
    },
  ];

  // Renders the inner content for each block id.
  const renderBlock = (id: DashboardBlockId) => {
    switch (id) {
      case "kpisTop":
        return (
          <div className="grid grid-cols-2 gap-2.5">
            {kpis.map((item) => {
              const ItemIcon = item.Icon;
              const isMoney = item.value.startsWith("R$");
              return (
                <div
                  key={item.label}
                  className="bg-card rounded-xl border border-border shadow-sm px-3 py-2.5 flex flex-col justify-between min-w-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className={cn("rounded-md p-1.5 shrink-0", item.iconBg)}>
                        <ItemIcon className={cn("w-3.5 h-3.5", item.iconColor)} />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-1 break-words">
                      {item.label}
                    </p>
                    <p
                      className={cn(
                        "font-bold text-foreground tabular-nums leading-tight tracking-tight break-words",
                        isMoney ? "text-sm" : "text-lg"
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                  {item.trend && (
                    <div className="mt-1.5 text-[9.5px] flex items-center gap-1 flex-wrap leading-tight">
                      <span
                        className={cn(
                          "font-bold tracking-tight",
                          item.trend.isPositive ? "text-success" : "text-destructive"
                        )}
                      >
                        {item.trend.value}
                      </span>
                      <span className="text-muted-foreground font-medium truncate">
                        {item.trend.text}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      case "metas":
        return (
          <DashboardMetaCard
            year={filterYear ?? now.getFullYear()}
            month={filterMonth ?? now.getMonth() + 1}
            monthLabel={new Date(
              filterYear ?? now.getFullYear(),
              (filterMonth ?? now.getMonth() + 1) - 1,
              1
            ).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
            selectedOperatorUserId={
              selectedOperators.length === 1 ? selectedOperators[0] : null
            }
            received={stats?.total_recebido ?? 0}
          />
        );
      case "agendamentos":
        return (
          <AgendamentosHojeCard
            callbacks={callbacks}
            showOperator={canViewAllAgendados}
          />
        );
      case "totalRecebido":
        return <TotalRecebidoCard totalRecebido={stats?.total_recebido ?? 0} />;
      case "parcelas":
        return (
          <ParcelasProgramadasCard
            vencimentos={vencimentos}
            browseDate={browseDate}
            onNavigateDate={navigateDate}
            onPickDate={setBrowseDate}
          />
        );
      default:
        return null;
    }
  };

  const visibleOrder = layout.order.filter((id) => layout.visible[id]);

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full min-h-0">
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

      {/* Drag-and-drop grid: cards reorder freely; layout persists per user */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
          <div
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
            style={{ gridAutoFlow: "dense" }}
          >
            {visibleOrder.map((id) => (
              <SortableCard key={id} id={id} spanClassName={SPAN_CLASS[id]}>
                {renderBlock(id)}
              </SortableCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
