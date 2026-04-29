import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
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
import KpisOperacionaisCard from "@/components/dashboard/KpisOperacionaisCard";
import KpisFinanceirosCard from "@/components/dashboard/KpisFinanceirosCard";
import SortableCard from "@/components/dashboard/SortableCard";
import { DashboardBlockId, useDashboardLayout } from "@/hooks/useDashboardLayout";

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

  // Ticket médio dos acordos do dia: total_negociado_dia / acordos_dia.
  // Usa a mesma lógica do RPC get_dashboard_stats para `_negociado`,
  // mas filtrando apenas os acordos criados HOJE.
  const { data: ticketMedioDia = 0 } = useQuery({
    queryKey: ["dashboard-ticket-medio-dia", rpcUserId, rpcUserIdsKey, profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return 0;
      const today = new Date().toISOString().slice(0, 10);
      let q = supabase
        .from("agreements")
        .select("entrada_value, new_installment_value, custom_installment_values, created_by")
        .eq("tenant_id", profile.tenant_id)
        .gte("created_at", `${today}T00:00:00Z`)
        .lte("created_at", `${today}T23:59:59Z`)
        .not("status", "in", "(cancelled,rejected)");
      if (rpcUserIds) q = q.in("created_by", rpcUserIds);
      else if (rpcUserId) q = q.eq("created_by", rpcUserId);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) return 0;
      const total = data.reduce((acc, a: any) => {
        const civ = a.custom_installment_values || {};
        const v = Number(a.entrada_value) > 0
          ? Number(civ.entrada ?? a.entrada_value)
          : Number(civ["1"] ?? a.new_installment_value ?? 0);
        return acc + (Number.isFinite(v) ? v : 0);
      }, 0);
      return total / data.length;
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

  // Span (Tailwind classes) per block — grid 6 colunas no desktop.
  // Linha 1 (topo): KPIs Operacionais (3 cols) | KPIs Financeiros (3 cols)
  // Linha 2 (base): Agendamentos (2) | Parcelas (2) | Metas (2)
  // Linha 3 (extra): Total Recebido (6 cols)
  const SPAN_CLASS: Record<DashboardBlockId, string> = {
    kpisOperacionais: "col-span-1 md:col-span-2 lg:col-span-3 row-span-1",
    kpisFinanceiros: "col-span-1 md:col-span-2 lg:col-span-3 row-span-1",
    agendamentos: "col-span-1 md:col-span-2 lg:col-span-2 row-span-1",
    parcelas: "col-span-1 md:col-span-2 lg:col-span-2 row-span-1",
    metas: "col-span-1 md:col-span-2 lg:col-span-2 row-span-1",
    totalRecebido: "col-span-1 md:col-span-2 lg:col-span-2 row-span-1",
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

  const trendAcionados = stats ? pctDelta(acionadosHoje, stats.acionados_ontem ?? 0) : null;
  const trendAcordosDia = stats ? pctDelta(stats.acordos_dia ?? 0, stats.acordos_dia_anterior ?? 0) : null;
  const trendAcordosMes = stats ? pctDelta(stats.acordos_mes ?? 0, stats.acordos_mes_anterior ?? 0) : null;
  const trendNegociadoMes = stats ? pctDelta(stats.total_negociado_mes ?? 0, stats.total_negociado_mes_anterior ?? 0) : null;
  const trendQuebra = stats ? pctDelta(stats.total_quebra ?? 0, stats.total_quebra_mes_anterior ?? 0, true) : null;
  const trendPendentes = stats ? pctDelta(stats.total_pendente ?? 0, stats.total_pendente_mes_anterior ?? 0, true) : null;

  // Renders the inner content for each block id.
  const renderBlock = (id: DashboardBlockId) => {
    switch (id) {
      case "kpisOperacionais":
        return (
          <KpisOperacionaisCard
            acionadosHoje={acionadosHoje}
            acordosDia={stats?.acordos_dia ?? 0}
            acordosMes={stats?.acordos_mes ?? 0}
            ticketMedioDia={ticketMedioDia}
            trendAcionados={trendAcionados}
            trendAcordosDia={trendAcordosDia}
            trendAcordosMes={trendAcordosMes}
          />
        );
      case "kpisFinanceiros":
        return (
          <KpisFinanceirosCard
            quebra={stats?.total_quebra ?? 0}
            pendentes={stats?.total_pendente ?? 0}
            colchao={stats?.total_projetado ?? 0}
            trendQuebra={trendQuebra}
            trendPendentes={trendPendentes}
          />
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 auto-rows-[minmax(220px,auto)] items-stretch"
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
