
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronLeft, ChevronRight, BarChart3, FileText, Phone, FileCheck, CalendarCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
          <div className="shrink-0 grid grid-cols-3 gap-2">
            {[
              {
                label: "Acionados Hoje",
                value: String(acionadosHoje),
                tooltip: "Clientes únicos acessados hoje (perfil ou atendimento), excluindo os que já viraram acordo seu.",
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
            ].map((item) => {
              const ItemIcon = item.Icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "bg-card rounded-xl border border-border/60 shadow-sm px-4 py-3 flex-1 min-h-0 flex flex-col justify-center"
                  )}
                  title={item.tooltip}
                >
                  <div className="flex items-center justify-between">
                    <div className={cn("rounded-lg p-1.5", item.iconBg)}>
                      <ItemIcon className={cn("w-4 h-4", item.iconColor)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{item.label}</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums leading-tight">
                    {item.value}
                  </p>
                </div>
              );
            })}
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

        {/* Coluna 2: Colchão / 1ª Parcela Mês / Total Negociado Mês  +  Parcelas Programadas */}
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

          {/* Parcelas Programadas */}
          <div className="bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm w-full flex-1 min-h-0 flex flex-col">
            {/* Banner de data destacado */}
            <div className="px-3 pt-3 shrink-0">
              <div className="flex items-center justify-between bg-primary/10 rounded-xl px-2 py-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-primary hover:bg-primary/20"
                  onClick={() => navigateDate(-1)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex-1 text-base font-bold text-primary tracking-wide text-center hover:bg-primary/10 rounded-md py-1 transition-colors cursor-pointer">
                      {format(browseDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                        ? "HOJE"
                        : format(browseDate, "dd/MM/yyyy")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 border-0 bg-transparent shadow-none z-50"
                    align="center"
                    side="bottom"
                    sideOffset={8}
                  >
                    <GlassCalendar selectedDate={browseDate} onDateSelect={(date) => setBrowseDate(date)} />
                  </PopoverContent>
                </Popover>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-primary hover:bg-primary/20"
                  onClick={() => navigateDate(1)}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Cabeçalho com título e badges */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Parcelas Programadas</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-muted text-foreground text-xs font-bold">
                  {vencimentos.length}
                </span>
                <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-success text-success-foreground text-xs font-bold">
                  {vencimentos.filter((v) => (v as any).effective_status === "paid").length}
                </span>
              </div>
            </div>

            {vencimentos.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-10 text-muted-foreground">
                <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <CalendarClock className="w-5 h-5 text-muted-foreground/70" />
                </div>
                <p className="text-xs font-medium">Nenhum vencimento</p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">para esta data</p>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border/60 hover:bg-transparent">
                      <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Nome
                      </TableHead>
                      <TableHead className="h-9 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Credor
                      </TableHead>
                      <TableHead className="h-9 px-2 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Valor
                      </TableHead>
                      <TableHead className="h-9 px-4 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vencimentos.map((v, idx) => {
                      const credorShort = (v.credor || "").trim().split(/\s+/).slice(0, 2).join(" ");
                      const status = (v as any).effective_status;
                      const statusLabel =
                        status === "paid" ? "QUITADO" : status === "overdue" ? "ATRASADO" : "ANDAMENTO";
                      const statusClass =
                        status === "paid"
                          ? "bg-success text-success-foreground"
                          : status === "overdue"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted text-muted-foreground";
                      return (
                        <TableRow
                          key={`${v.agreement_id}-${v.numero_parcela}-${idx}`}
                          className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="py-2.5 px-4 text-sm font-medium">
                            <Link
                              to={`/carteira/${encodeURIComponent(v.client_cpf.replace(/\D/g, ""))}`}
                              className="text-primary hover:underline"
                            >
                              {v.client_name}
                            </Link>
                          </TableCell>
                          <TableCell className="py-2.5 px-2 text-sm text-muted-foreground">
                            {credorShort}
                          </TableCell>
                          <TableCell className="py-2.5 px-2 text-sm text-right text-foreground tabular-nums">
                            {formatCurrency(Number(v.valor_parcela))}
                          </TableCell>
                          <TableCell className="py-2.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-[96px] rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClass}`}
                            >
                              {statusLabel}
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

        {/* Coluna 3: Recebido / Quebra / Pendentes  +  Meta */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-1 gap-2.5 shrink-0">
            <StatCard title="Total Recebido" value={formatCurrency(stats?.total_recebido ?? 0)} icon="received" />
            <StatCard title="Total de Quebra" value={formatCurrency(stats?.total_quebra ?? 0)} icon="broken" />
            <StatCard title="Pendentes" value={formatCurrency(stats?.total_pendente ?? 0)} icon="receivable" />
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
      </div>
    </div>
  );
};

export default DashboardPage;
