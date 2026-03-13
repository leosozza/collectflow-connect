import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUrlState } from "@/hooks/useUrlState";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeft, Download, Target, Award, TrendingUp, AlertTriangle, MessageCircle } from "lucide-react";
import { parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";

interface AgreementRow {
  id: string;
  client_cpf: string;
  client_name: string;
  credor: string;
  proposed_total: number;
  original_total: number;
  status: string;
  created_at: string;
  created_by: string;
  first_due_date: string;
  new_installments: number;
  new_installment_value: number;
  entrada_value: number | null;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_COLORS: Record<string, string> = {
  approved: "hsl(142, 71%, 45%)",
  completed: "hsl(142, 71%, 35%)",
  pending: "hsl(38, 92%, 50%)",
  pending_approval: "hsl(38, 70%, 60%)",
  overdue: "hsl(24, 95%, 53%)",
  cancelled: "hsl(0, 84%, 60%)",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Vigentes",
  completed: "Pagos",
  pending: "Pendentes",
  pending_approval: "Aguardando",
  overdue: "Vencidos",
  cancelled: "Cancelados",
};

const generateYearOptions = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 3; i++) years.push(now.getFullYear() - i);
  return years;
};

const InfoTooltip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <MessageCircle className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-default transition-colors" />
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[220px] text-xs">
      {text}
    </TooltipContent>
  </Tooltip>
);

const AnalyticsPage = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const now = new Date();

  const [selectedYears, setSelectedYears] = useUrlState("years", [now.getFullYear().toString()]);
  const [selectedMonths, setSelectedMonths] = useUrlState("months", [] as string[]);
  const [selectedOperators, setSelectedOperators] = useUrlState("operators", [] as string[]);
  const [selectedCredores, setSelectedCredores] = useUrlState("credores", [] as string[]);

  const isOperator = profile?.role !== "admin";

  // Fetch agreements with real payment data via RPC
  const { data: allAgreements = [] } = useQuery({
    queryKey: ["analytics-agreements-payments", tenant?.id, isOperator ? profile?.id : "all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_analytics_payments", {
        _tenant_id: tenant!.id,
      });
      if (error) throw error;
      let results = (data || []) as Array<{
        agreement_id: string;
        created_by: string;
        credor: string;
        created_at: string;
        proposed_total: number;
        original_total: number;
        status: string;
        total_pago: number;
      }>;
      if (isOperator && profile?.id) {
        results = results.filter((r) => r.created_by === profile.id);
      }
      // Map to AgreementRow-compatible shape
      return results.map((r) => ({
        id: r.agreement_id,
        client_cpf: "",
        client_name: "",
        credor: r.credor,
        proposed_total: Number(r.proposed_total),
        original_total: Number(r.original_total),
        status: r.status,
        created_at: r.created_at,
        created_by: r.created_by,
        first_due_date: r.created_at,
        new_installments: 0,
        new_installment_value: 0,
        entrada_value: null,
        total_pago: Number(r.total_pago),
      })) as (AgreementRow & { total_pago: number })[];
    },
    enabled: !!tenant?.id,
  });

  // Also fetch full agreement details for export & heatmap
  const { data: allAgreementsFull = [] } = useQuery({
    queryKey: ["analytics-agreements-full", tenant?.id, isOperator ? profile?.id : "all"],
    queryFn: async () => {
      let query = supabase
        .from("agreements")
        .select("id, client_cpf, client_name, credor, proposed_total, original_total, status, created_at, created_by, first_due_date, new_installments, new_installment_value, entrada_value")
        .not("status", "in", "(rejected)");
      if (tenant?.id) query = query.eq("tenant_id", tenant.id);
      if (isOperator && profile?.id) query = query.eq("created_by", profile.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AgreementRow[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch operators filtered by tenant
  const { data: operators = [] } = useQuery({
    queryKey: ["operators", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: !isOperator && !!tenant?.id,
  });

  const yearOpts = useMemo(() => generateYearOptions().map((y) => ({ value: y.toString(), label: y.toString() })), []);
  const monthOpts = useMemo(() => monthNames.map((name, i) => ({ value: i.toString(), label: name })), []);
  const operatorOpts = useMemo(() => operators.map((o) => ({ value: o.id, label: o.full_name || "Sem nome" })), [operators]);
  const credorOpts = useMemo(() => [...new Set(allAgreements.map((a) => a.credor))].sort().map((c) => ({ value: c, label: c })), [allAgreements]);

  // Filter agreements by selected filters
  const filteredAgreements = useMemo(() => {
    return allAgreements.filter((a) => {
      const d = parseISO(a.created_at);
      if (selectedYears.length > 0 && !selectedYears.includes(d.getFullYear().toString())) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(d.getMonth().toString())) return false;
      if (selectedOperators.length > 0 && !selectedOperators.includes(a.created_by || "")) return false;
      if (selectedCredores.length > 0 && !selectedCredores.includes(a.credor)) return false;
      return true;
    });
  }, [allAgreements, selectedYears, selectedMonths, selectedOperators, selectedCredores]);

  // Exclude cancelled from active KPIs
  const activeAgreements = filteredAgreements.filter((a) => a.status !== "cancelled");

  // Status classifications
  const pagos = activeAgreements.filter((a) => a.status === "completed");
  const vigentes = activeAgreements.filter((a) => a.status === "approved");
  const pendentes = activeAgreements.filter((a) => a.status === "pending" || a.status === "pending_approval");
  const vencidos = activeAgreements.filter((a) => a.status === "overdue");
  const cancelados = filteredAgreements.filter((a) => a.status === "cancelled");

  const totalNegociado = activeAgreements.reduce((s, a) => s + Number(a.proposed_total), 0);
  const totalQuebra = cancelados.reduce((s, a) => s + Number(a.proposed_total), 0);

  // Total Recebido: soma real dos pagamentos vinculados a acordos
  const totalRecebido = activeAgreements.reduce((s, a) => s + Number((a as any).total_pago || 0), 0);

  // Acordos com pagamento > 0
  const acordosComPagamento = activeAgreements.filter((a) => Number((a as any).total_pago || 0) > 0);

  // Total Pendente: soma do saldo devedor de toda a carteira (clients)
  const { data: totalCarteiraPendente = 0 } = useQuery({
    queryKey: ["analytics-carteira-pendente", tenant?.id],
    queryFn: async () => {
      let total = 0;
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("clients")
          .select("valor_atualizado, valor_saldo, valor_parcela")
          .eq("tenant_id", tenant!.id)
          .in("status", ["pendente"])
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        total += data.reduce(
          (sum, c) => sum + Number(c.valor_atualizado || c.valor_saldo || c.valor_parcela || 0),
          0
        );
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return total;
    },
    enabled: !!tenant?.id,
  });
  const totalPendente = totalCarteiraPendente;

  // KPIs based on real payment data
  const taxaRecuperacao = totalNegociado > 0 ? ((totalRecebido / totalNegociado) * 100).toFixed(1) : "0";
  const ticketMedio = acordosComPagamento.length > 0 ? totalRecebido / acordosComPagamento.length : 0;
  const percentRecebimento = activeAgreements.length > 0 ? ((acordosComPagamento.length / activeAgreements.length) * 100).toFixed(1) : "0";

  // Portfolio conversion rate: agreements with payments > 0 vs total active
  const totalAtivos = vigentes.length + pendentes.length + vencidos.length + acordosComPagamento.length;
  const taxaConversao = totalAtivos > 0 ? (acordosComPagamento.length / totalAtivos) * 100 : 0;

  // Evolution chart data based on agreements.created_at with real payments
  const evolutionData = useMemo(() => {
    const years = selectedYears.length > 0 ? selectedYears.map(Number) : generateYearOptions();
    return monthLabels.map((label, monthIdx) => {
      const monthAgreements = allAgreements.filter((a) => {
        const d = parseISO(a.created_at);
        if (!years.includes(d.getFullYear()) || d.getMonth() !== monthIdx) return false;
        if (selectedOperators.length > 0 && !selectedOperators.includes(a.created_by || "")) return false;
        if (selectedCredores.length > 0 && !selectedCredores.includes(a.credor)) return false;
        return true;
      });
      return {
        name: label,
        negociado: monthAgreements.filter((a) => a.status !== "cancelled" && a.status !== "rejected").reduce((s, a) => s + Number(a.proposed_total), 0),
        recebido: monthAgreements.filter((a) => a.status !== "cancelled" && a.status !== "rejected").reduce((s, a) => s + Number((a as any).total_pago || 0), 0),
        quebra: monthAgreements.filter((a) => a.status === "cancelled").reduce((s, a) => s + Number(a.proposed_total), 0),
      };
    });
  }, [allAgreements, selectedYears, selectedOperators, selectedCredores]);

  // Status pie based on agreement statuses
  const statusPieData = useMemo(() => {
    const groups = [
      { name: "Pagos", value: pagos.length, color: STATUS_COLORS.completed },
      { name: "Vigentes", value: vigentes.length, color: STATUS_COLORS.approved },
      { name: "Pendentes", value: pendentes.length, color: STATUS_COLORS.pending },
      { name: "Vencidos", value: vencidos.length, color: STATUS_COLORS.overdue },
      { name: "Cancelados", value: cancelados.length, color: STATUS_COLORS.cancelled },
    ];
    return groups.filter((d) => d.value > 0);
  }, [pagos, vigentes, pendentes, vencidos, cancelados]);

  // Top 5 credores by pending value
  const top5Credores = useMemo(() => {
    const map = new Map<string, { credor: string; total: number }>();
    [...vigentes, ...pendentes, ...vencidos].forEach((a) => {
      if (!map.has(a.credor)) map.set(a.credor, { credor: a.credor, total: 0 });
      map.get(a.credor)!.total += Number(a.proposed_total);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [vigentes, pendentes, vencidos]);

  // Heatmap by first_due_date day (use full agreement data)
  const heatmapData = useMemo(() => {
    const counts = new Array(31).fill(0);
    allAgreementsFull.filter((a) => a.status !== "cancelled" && a.status !== "rejected").forEach((a) => {
      const day = parseISO(a.first_due_date).getDate();
      counts[day - 1] += 1;
    });
    const max = Math.max(...counts, 1);
    return counts.map((count, i) => ({ day: i + 1, count, intensity: count / max }));
  }, [allAgreementsFull]);

  // Export (use full agreement data)
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(allAgreementsFull.map((a) => ({
      Cliente: a.client_name,
      CPF: a.client_cpf,
      Credor: a.credor,
      Status: STATUS_LABELS[a.status] || a.status,
      "Valor Negociado": Number(a.proposed_total),
      "Valor Original": Number(a.original_total),
      "1º Vencimento": a.first_due_date,
      "Data Criação": a.created_at,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytics");
    XLSX.writeFile(wb, `analytics-${selectedYears.join("-") || "todos"}.xlsx`);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <MultiSelect options={yearOpts} selected={selectedYears} onChange={setSelectedYears} allLabel="Todos Anos" className="w-[110px]" />
            <MultiSelect options={monthOpts} selected={selectedMonths} onChange={setSelectedMonths} allLabel="Todos Meses" className="w-[120px]" />
            {!isOperator && (
              <MultiSelect options={operatorOpts} selected={selectedOperators} onChange={setSelectedOperators} allLabel="Todos Op." className="w-[120px]" />
            )}
            <MultiSelect options={credorOpts} selected={selectedCredores} onChange={setSelectedCredores} allLabel="Todos Cred." className="w-[120px]" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExport} title="Exportar Excel">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isOperator ? (
            <>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Soma do valor negociado de todos os acordos ativos no período." /></div>
                <AlertTriangle className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Total Negociado</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalNegociado)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Soma do valor de acordos cancelados (quebra)." /></div>
                <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Total de Quebra</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(totalQuebra)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Soma dos pagamentos reais (valor_pago) dos clientes vinculados aos seus acordos." /></div>
                <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Total Recebido</p>
                <p className="text-xl font-bold text-success">{formatCurrency(totalRecebido)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Percentual de acordos com pagamentos em relação ao total de acordos ativos." /></div>
                <Target className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">% de Recebimento</p>
                <p className="text-xl font-bold text-foreground">{percentRecebimento}%</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Soma do saldo devedor de toda a carteira cadastrada com status pendente." /></div>
                <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Total Pendente</p>
                <p className="text-xl font-bold text-destructive">{formatCurrency(totalPendente)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Percentual do valor recebido em relação ao valor total negociado nos acordos." /></div>
                <Target className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Taxa de Recuperação</p>
                <p className="text-xl font-bold text-foreground">{taxaRecuperacao}%</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Valor médio recebido por acordo com pagamentos no período." /></div>
                <Award className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(ticketMedio)}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
                <div className="absolute top-2 right-2"><InfoTooltip text="Soma dos pagamentos reais (valor_pago) dos clientes vinculados a acordos no período." /></div>
                <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Total Recebido</p>
                <p className="text-xl font-bold text-success">{formatCurrency(totalRecebido)}</p>
              </div>
            </>
          )}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Evolution line chart */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
            <div className="absolute top-3 right-3"><InfoTooltip text="Evolução mês a mês do valor negociado, recebido e quebrado baseado na data de criação do acordo." /></div>
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Evolução Mensal ({selectedYears.length > 0 ? selectedYears.join(", ") : "Todos"})</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Legend />
                <Line type="monotone" dataKey="negociado" name="Negociado" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="recebido" name="Recebido" stroke={STATUS_COLORS.completed} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="quebra" name="Quebra" stroke={STATUS_COLORS.cancelled} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Portfolio conversion */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative flex flex-col">
            <div className="absolute top-3 right-3"><InfoTooltip text="Percentual de acordos com pagamentos recebidos em relação ao total de acordos ativos." /></div>
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Taxa de Conversão de Acordos</h3>
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <p className="text-5xl font-bold text-primary">{taxaConversao.toFixed(1)}%</p>
              <Progress value={taxaConversao} className="w-3/4 h-3" />
              <div className="flex gap-6 text-xs text-muted-foreground">
                <span>Total Ativos: <strong className="text-foreground">{totalAtivos}</strong></span>
                <span>Com Pagamento: <strong className="text-foreground">{acordosComPagamento.length}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Status pie */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
            <div className="absolute top-3 right-3"><InfoTooltip text="Distribuição dos status dos acordos formalizados no período selecionado." /></div>
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Distribuição de Status</h3>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                    {statusPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(value: number, name: string) => [`${value} acordos`, name]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
            )}
          </div>

          {/* Top 5 credores */}
          {!isOperator && (
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
              <div className="absolute top-3 right-3"><InfoTooltip text="Os 5 credores com maior valor em acordos pendentes/vigentes/vencidos." /></div>
              <h3 className="text-sm font-semibold text-card-foreground mb-3">Top 5 Maiores Credores</h3>
              {top5Credores.length > 0 ? (
                <div className="space-y-2">
                  {top5Credores.map((d, i) => (
                    <div key={d.credor} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                        <p className="text-xs font-medium text-foreground truncate max-w-[160px]">{d.credor}</p>
                      </div>
                      <span className="text-xs font-bold text-destructive">{formatCurrency(d.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">Sem credores pendentes</div>
              )}
            </div>
          )}

          {/* Heatmap */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
            <div className="absolute top-3 right-3"><InfoTooltip text="Concentração de vencimentos por dia do mês baseado no 1º vencimento dos acordos." /></div>
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Heatmap de Vencimentos</h3>
            <div className="grid grid-cols-7 gap-1">
              {heatmapData.map((d) => (
                <div
                  key={d.day}
                  className="aspect-square rounded flex items-center justify-center text-[10px] font-medium"
                  style={{
                    backgroundColor: d.count === 0
                      ? "hsl(var(--muted) / 0.3)"
                      : `hsl(24, 95%, ${70 - d.intensity * 40}%)`,
                    color: d.intensity > 0.5 ? "white" : "hsl(var(--foreground))",
                  }}
                  title={`Dia ${d.day}: ${d.count} acordos`}
                >
                  {d.day}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default AnalyticsPage;
