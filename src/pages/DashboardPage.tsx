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
import DashboardMetaCard from "@/components/dashboard/DashboardMetaCard";
import ParcelasProgramadasCard, {
  VencimentoRow,
} from "@/components/dashboard/ParcelasProgramadasCard";
import TotalRecebidoCard from "@/components/dashboard/TotalRecebidoCard";
import AgendamentosHojeCard from "@/components/dashboard/AgendamentosHojeCard";
import CustomizeDashboardDialog from "@/components/dashboard/CustomizeDashboardDialog";
import KpisOperacionaisCard from "@/components/dashboard/KpisOperacionaisCard";
import KpisFinanceirosCard from "@/components/dashboard/KpisFinanceirosCard";
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

type TicketAgreementRow = {
  entrada_value: number | null;
  new_installment_value: number | null;
  custom_installment_values: unknown;
};

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

function parseCurrencyLike(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCustomInstallmentValue(
  customValues: unknown,
  key: "entrada" | "1"
): number | null {
  if (!customValues || typeof customValues !== "object" || Array.isArray(customValues)) {
    return null;
  }
  return parseCurrencyLike((customValues as Record<string, unknown>)[key]);
}

function getAgreementTicketBase(row: TicketAgreementRow): number {
  const entradaValue = Number(row.entrada_value || 0);
  if (entradaValue > 0) {
    return getCustomInstallmentValue(row.custom_installment_values, "entrada") ?? entradaValue;
  }
  return (
    getCustomInstallmentValue(row.custom_installment_values, "1") ??
    Number(row.new_installment_value || 0)
  );
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

  const rpcUserIds: string[] | null =
    canViewAll && selectedOperators.length > 1 ? selectedOperators : null;
  const rpcUserId = canViewAll
    ? (selectedOperators.length === 1 ? selectedOperators[0] : null)
    : (profile?.user_id ?? null);
  const rpcUserIdsKey = rpcUserIds ? rpcUserIds.join(",") : null;
  const filterYear = selectedYears.length === 1 ? parseInt(selectedYears[0]) : null;
  const filterMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) + 1 : null;

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

  const todayKey = format(now, "yyyy-MM-dd");
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const { data: ticketMedioDia = 0 } = useQuery({
    queryKey: ["dashboard-ticket-medio-dia", todayKey, rpcUserId, rpcUserIdsKey, profile?.tenant_id],
    queryFn: async () => {
      let query = supabase
        .from("agreements")
        .select("entrada_value, new_installment_value, custom_installment_values")
        .eq("tenant_id", profile!.tenant_id!)
        .not("status", "in", "(cancelled,rejected)")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", tomorrowStart.toISOString());

      if (rpcUserIds) query = query.in("created_by", rpcUserIds);
      else if (rpcUserId) query = query.eq("created_by", rpcUserId);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as TicketAgreementRow[];
      if (rows.length === 0) return 0;
      const total = rows.reduce((sum, row) => sum + getAgreementTicketBase(row), 0);
      return total / rows.length;
    },
    enabled: !!profile?.tenant_id,
    refetchInterval: 60_000,
  });

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

  const trendAcionados = stats ? pctDelta(acionadosHoje, stats.acionados_ontem ?? 0) : null;
  const trendAcordosDia = stats ? pctDelta(stats.acordos_dia ?? 0, stats.acordos_dia_anterior ?? 0) : null;
  const trendAcordosMes = stats ? pctDelta(stats.acordos_mes ?? 0, stats.acordos_mes_anterior ?? 0) : null;
  const trendQuebra = stats ? pctDelta(stats.total_quebra ?? 0, stats.total_quebra_mes_anterior ?? 0, true) : null;
  const trendPendentes = stats ? pctDelta(stats.total_pendente ?? 0, stats.total_pendente_mes_anterior ?? 0, true) : null;

  const isVisible = (id: DashboardBlockId) => layout.visible[id];

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

      <div className="grid flex-1 min-h-0 overflow-hidden grid-cols-1 md:grid-cols-2 xl:grid-cols-12 xl:grid-rows-[minmax(0,0.72fr)_minmax(0,1.28fr)] gap-3">
        {isVisible("kpisOperacionais") && (
          <section className="min-h-0 h-full md:col-span-2 xl:col-span-4 xl:row-start-1">
            {renderBlock("kpisOperacionais")}
          </section>
        )}
        {isVisible("kpisFinanceiros") && (
          <section className="min-h-0 h-full md:col-span-2 xl:col-span-4 xl:col-start-5 xl:row-start-1">
            {renderBlock("kpisFinanceiros")}
          </section>
        )}
        {isVisible("totalRecebido") && (
          <section className="min-h-0 h-full md:col-span-2 xl:col-span-4 xl:col-start-9 xl:row-start-1">
            {renderBlock("totalRecebido")}
          </section>
        )}
        {isVisible("agendamentos") && (
          <section className="min-h-0 h-full xl:col-span-4 xl:row-start-2">
            {renderBlock("agendamentos")}
          </section>
        )}
        {isVisible("parcelas") && (
          <section className="min-h-0 h-full md:col-span-2 xl:col-span-4 xl:col-start-5 xl:row-start-2">
            {renderBlock("parcelas")}
          </section>
        )}
        {isVisible("metas") && (
          <section className="min-h-0 h-full xl:col-span-4 xl:col-start-9 xl:row-start-2">
            {renderBlock("metas")}
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
