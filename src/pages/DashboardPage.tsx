import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { BarChart3, FileText, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { useNavigate } from "react-router-dom";

import { usePermissions } from "@/hooks/usePermissions";
import { useScheduledCallbacks } from "@/hooks/useScheduledCallbacks";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import DashboardMetaCard from "@/components/dashboard/DashboardMetaCard";
import ParcelasProgramadasCard, {
  VencimentoRow,
} from "@/components/dashboard/ParcelasProgramadasCard";
import TotalRecebidoCard from "@/components/dashboard/TotalRecebidoCard";
import AgendamentosHojeCard from "@/components/dashboard/AgendamentosHojeCard";
import CustomizeDashboardDialog from "@/components/dashboard/CustomizeDashboardDialog";
import KpisGridCard from "@/components/dashboard/KpisGridCard";
import { DashboardBlockId, useDashboardLayout } from "@/hooks/useDashboardLayout";

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

async function callDashboardStats(params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("get_dashboard_stats_v2" as any, params as any);
  if (!error) return data;

  console.warn("[Dashboard] get_dashboard_stats_v2 failed; falling back to get_dashboard_stats", error);
  const legacyParams = { ...params };
  delete legacyParams._tenant_id;
  const legacy = await supabase.rpc("get_dashboard_stats", legacyParams as any);
  if (legacy.error) {
    console.error("[Dashboard] legacy get_dashboard_stats also failed", legacy.error);
    throw legacy.error;
  }
  return legacy.data;
}

async function callDashboardVencimentos(params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("get_dashboard_vencimentos_v2" as any, params as any);
  if (!error) return data;

  console.warn("[Dashboard] get_dashboard_vencimentos_v2 failed; falling back to get_dashboard_vencimentos", error);
  const legacyParams = { ...params };
  delete legacyParams._tenant_id;
  const legacy = await supabase.rpc("get_dashboard_vencimentos", legacyParams as any);
  if (legacy.error) {
    console.error("[Dashboard] legacy get_dashboard_vencimentos also failed", legacy.error);
    throw legacy.error;
  }
  return legacy.data;
}

const DashboardPage = () => {
  const { profile } = useAuth();
  const { tenantId: effectiveTenantId } = useEffectiveTenantId();
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

  const { data: operators = [] } = useQuery({
    queryKey: ["dashboard-operators", effectiveTenantId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("user_id, full_name, role")
        .eq("tenant_id", effectiveTenantId!)
        .neq("role", "admin");
      return (data || []).map(p => ({ value: p.user_id, label: p.full_name || "Sem nome" }));
    },
    enabled: !!effectiveTenantId && canViewAll,
  });

  const rpcUserIds: string[] | null =
    canViewAll && selectedOperators.length > 1 ? selectedOperators : null;
  const rpcUserId = canViewAll
    ? (selectedOperators.length === 1 ? selectedOperators[0] : null)
    : (profile?.user_id ?? null);
  const rpcUserIdsKey = rpcUserIds ? rpcUserIds.join(",") : null;
  const filterYear = selectedYears.length === 1 ? parseInt(selectedYears[0]) : null;
  const filterMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) + 1 : null;

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", effectiveTenantId, rpcUserId, rpcUserIdsKey, filterYear, filterMonth],
    queryFn: async () => {
      const params: Record<string, unknown> = { _tenant_id: effectiveTenantId };
      if (rpcUserIds) params._user_ids = rpcUserIds;
      else if (rpcUserId) params._user_id = rpcUserId;
      if (filterYear) params._year = filterYear;
      if (filterMonth) params._month = filterMonth;

      const data = await callDashboardStats(params);
      const row = Array.isArray(data) ? data[0] : data;
      return row as DashboardStats;
    },
    enabled: !!effectiveTenantId,
  });

  const { data: acionadosHoje = 0 } = useQuery({
    queryKey: ["acionados-hoje", effectiveTenantId, rpcUserId, rpcUserIdsKey],
    queryFn: async () => {
      const params: Record<string, unknown> = { _tenant_id: effectiveTenantId };
      if (rpcUserIds) params._user_ids = rpcUserIds;
      else if (rpcUserId) params._user_id = rpcUserId;
      const { data, error } = await supabase.rpc("get_acionados_hoje", params as any);
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!effectiveTenantId,
    refetchInterval: 60_000,
  });

  const browseDateStr = format(browseDate, "yyyy-MM-dd");
  const { data: vencimentos = [] } = useQuery({
    queryKey: ["dashboard-vencimentos", effectiveTenantId, browseDateStr, rpcUserId, rpcUserIdsKey],
    queryFn: async () => {
      const params: Record<string, unknown> = { _tenant_id: effectiveTenantId, _target_date: browseDateStr };
      if (rpcUserIds) params._user_ids = rpcUserIds;
      else if (rpcUserId) params._user_id = rpcUserId;

      const data = await callDashboardVencimentos(params);
      return (data || []) as VencimentoRow[];
    },
    enabled: !!effectiveTenantId,
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

  const trendAcionados = stats ? pctDelta(acionadosHoje, stats.acionados_ontem ?? 0) : null;
  const trendAcordosDia = stats ? pctDelta(stats.acordos_dia ?? 0, stats.acordos_dia_anterior ?? 0) : null;
  const trendAcordosMes = stats ? pctDelta(stats.acordos_mes ?? 0, stats.acordos_mes_anterior ?? 0) : null;
  const trendQuebra = stats ? pctDelta(stats.total_quebra ?? 0, stats.total_quebra_mes_anterior ?? 0, true) : null;
  const trendPendentes = stats ? pctDelta(stats.total_pendente ?? 0, stats.total_pendente_mes_anterior ?? 0, true) : null;

  const isVisible = (id: DashboardBlockId) => layout.visible[id];

  return (
    <div className="flex flex-col gap-3 animate-fade-in h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Bem-vindo, {profile?.full_name || "Operador"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {permissions.canViewRelatorios && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => navigate("/relatorios")}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
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
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setCustomizeOpen(true)}
            title="Personalizar Dashboard"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Personalizar</span>
          </Button>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 overflow-hidden grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
        {isVisible("metas") && (
          <section className="min-h-0 h-full lg:col-span-3 lg:row-start-1">
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
          </section>
        )}
        {isVisible("totalRecebido") && (
          <section className="min-h-0 h-full lg:col-span-6 lg:col-start-4 lg:row-start-1">
            <TotalRecebidoCard
              totalRecebido={stats?.total_recebido ?? 0}
              tenantId={effectiveTenantId}
              year={filterYear ?? now.getFullYear()}
              month={filterMonth ?? now.getMonth() + 1}
              userId={rpcUserId}
              userIds={rpcUserIds}
            />
          </section>
        )}
        {isVisible("kpisGrid") && (
          <section className="min-h-0 h-full lg:col-span-3 lg:col-start-10 lg:row-start-1">
            <KpisGridCard
              acionadosHoje={acionadosHoje}
              acordosDia={stats?.acordos_dia ?? 0}
              acordosMes={stats?.acordos_mes ?? 0}
              quebra={stats?.total_quebra ?? 0}
              pendentes={stats?.total_pendente ?? 0}
              colchao={stats?.total_projetado ?? 0}
              trendAcionados={trendAcionados}
              trendAcordosDia={trendAcordosDia}
              trendAcordosMes={trendAcordosMes}
              trendQuebra={trendQuebra}
              trendPendentes={trendPendentes}
            />
          </section>
        )}
        {isVisible("agendamentos") && (
          <section className="min-h-0 h-full lg:col-span-3 lg:col-start-1 lg:row-start-2">
            <AgendamentosHojeCard
              callbacks={callbacks}
              showOperator={canViewAllAgendados}
            />
          </section>
        )}
        {isVisible("parcelas") && (
          <section className="min-h-0 h-full lg:col-span-6 lg:col-start-4 lg:row-start-2">
            <ParcelasProgramadasCard
              vencimentos={vencimentos}
              browseDate={browseDate}
              onNavigateDate={navigateDate}
              onPickDate={setBrowseDate}
            />
          </section>
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
