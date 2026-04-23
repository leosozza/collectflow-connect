
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronLeft, ChevronRight, BarChart3, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { MultiSelect } from "@/components/ui/multi-select";
import { useNavigate, Link } from "react-router-dom";

import { usePermissions } from "@/hooks/usePermissions";
import { useScheduledCallbacks } from "@/hooks/useScheduledCallbacks";
import ScheduledCallbacksCard from "@/components/dashboard/ScheduledCallbacksCard";
import DashboardMetaCard from "@/components/dashboard/DashboardMetaCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const generateYearOptions = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 3; i++) years.push(now.getFullYear() - i);
  return years;
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
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

interface VencimentoRow {
  agreement_id: string;
  client_cpf: string;
  client_name: string;
  credor: string;
  numero_parcela: number;
  valor_parcela: number;
  agreement_status: string;
}

const DashboardPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const permissions = usePermissions();

  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [browseDate, setBrowseDate] = useState(new Date());
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const { callbacks, canViewAll: canViewAllAgendados } = useScheduledCallbacks(scheduledDate);

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
  const filterMonth = selectedMonths.length === 1 ? parseInt(selectedMonths[0]) + 1 : null; // month is 0-indexed in UI

  // Dashboard stats from RPC
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

  // Acionados Hoje (CPFs únicos acessados hoje, excluindo os que já viraram acordo)
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

  // Vencimentos from RPC
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

  const yearOptions = useMemo(() => generateYearOptions().map((y) => ({ value: y.toString(), label: y.toString() })), []);
  const monthOptions = useMemo(() => monthNames.map((name, i) => ({ value: i.toString(), label: name })), []);

  const navigateDate = (dir: number) => {
    setBrowseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const totalVencimentos = vencimentos.reduce((s, v) => s + Number(v.valor_parcela), 0);

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in min-h-0">
      {/* Header with filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Bem-vindo, {profile?.full_name || "Operador"}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Layout em 3 colunas: cada coluna tem 3 stats compactos no topo + card funcional embaixo */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna 1: Acionados / Acordos Dia / Acordos Mês  +  Agendados */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-1 gap-2.5 shrink-0">
            <StatCard
              title="Acionados Hoje"
              value={String(acionadosHoje)}
              icon="phone"
              tooltip="Clientes únicos acessados hoje (perfil ou atendimento), excluindo os que já viraram acordo seu."
            />
            <StatCard title="Acordos do Dia" value={String(stats?.acordos_dia ?? 0)} icon="agreement" />
            <StatCard title="Acordos do Mês" value={String(stats?.acordos_mes ?? 0)} icon="agreement" />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <ScheduledCallbacksCard
              callbacks={callbacks}
              showOperator={canViewAllAgendados}
              selectedDate={scheduledDate}
              onDateChange={setScheduledDate}
            />
          </div>
        </div>

        {/* Coluna 2: Colchão / 1ª Parcela Mês / Total Negociado Mês  +  Meta */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-1 gap-2.5 shrink-0">
            <StatCard
              title="Colchão de Acordos"
              value={formatCurrency(stats?.total_projetado ?? 0)}
              icon="projected"
            />
            <StatCard
              title="Total 1ª Parcela do Mês"
              value={formatCurrency(stats?.total_negociado ?? 0)}
              icon="received"
            />
            <StatCard
              title="Total Negociado no Mês"
              value={formatCurrency(stats?.total_negociado_mes ?? 0)}
              icon="agreement"
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <DashboardMetaCard
              year={filterYear ?? now.getFullYear()}
              month={filterMonth ?? (now.getMonth() + 1)}
              monthLabel={new Date(filterYear ?? now.getFullYear(), (filterMonth ?? (now.getMonth() + 1)) - 1, 1)
                .toLocaleString("pt-BR", { month: "long", year: "numeric" })}
              selectedOperatorUserId={selectedOperators.length === 1 ? selectedOperators[0] : null}
              received={stats?.total_recebido ?? 0}
            />
          </div>
        </div>

        {/* Coluna 3: Recebido / Quebra / Pendentes  +  Parcelas Programadas */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-1 gap-2.5 shrink-0">
            <StatCard title="Total Recebido" value={formatCurrency(stats?.total_recebido ?? 0)} icon="received" />
            <StatCard title="Total de Quebra" value={formatCurrency(stats?.total_quebra ?? 0)} icon="broken" />
            <StatCard title="Pendentes" value={formatCurrency(stats?.total_pendente ?? 0)} icon="receivable" />
          </div>

          {/* Parcelas Programadas */}
          <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm w-full flex-1 min-h-0 flex flex-col">
            <div className="px-4 py-3 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Parcelas Programadas</h2>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 justify-self-start">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigateDate(-1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-sm font-semibold text-primary min-w-[110px] text-center px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer">
                        {format(browseDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "HOJE" : format(browseDate, "dd/MM/yyyy")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-0 bg-transparent shadow-none z-50" align="center" side="bottom" sideOffset={8}>
                      <GlassCalendar
                        selectedDate={browseDate}
                        onDateSelect={(date) => setBrowseDate(date)}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigateDate(1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
                    <span className="text-xs font-medium text-muted-foreground">Total</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(totalVencimentos)}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-card border border-border">
                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded bg-success/15 text-success text-[11px] font-bold">
                      {vencimentos.filter((v) => (v as any).effective_status === "paid").length}
                    </span>
                    <span className="text-muted-foreground text-[11px] font-medium">de</span>
                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded bg-secondary/10 text-secondary text-[11px] font-bold">
                      {vencimentos.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {vencimentos.length === 0 ? (
              <div className="p-5 text-center text-muted-foreground text-xs">
                Nenhum vencimento para esta data
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <Table>
                  <TableBody>
                    {vencimentos.map((v, idx) => {
                      const credorShort = (v.credor || "").trim().split(/\s+/).slice(0, 2).join(" ");
                      return (
                        <TableRow key={`${v.agreement_id}-${v.numero_parcela}-${idx}`} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-xs font-medium">
                            <Link
                              to={`/carteira/${encodeURIComponent(v.client_cpf.replace(/\D/g, ""))}`}
                              className="text-primary hover:underline"
                            >
                              {v.client_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{credorShort}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(Number(v.valor_parcela))}</TableCell>
                          <TableCell className="text-xs text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              (v as any).effective_status === "paid"
                                ? "bg-success/10 text-success border-success/30"
                                : (v as any).effective_status === "overdue"
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : "bg-warning/10 text-warning border-warning/30"
                            }`}>
                              {(v as any).effective_status === "paid" ? "Pago" : (v as any).effective_status === "overdue" ? "Acordo Atrasado" : "Pendente"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
