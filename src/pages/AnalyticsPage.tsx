import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { ArrowLeft, Download, Target, Award, TrendingUp, AlertTriangle, MessageCircle } from "lucide-react";
import { parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";

interface ClientRow {
  id: string;
  operator_id: string | null;
  valor_parcela: number;
  valor_pago: number;
  status: string;
  data_vencimento: string;
  nome_completo: string;
  cpf: string;
  credor: string;
  updated_at: string;
  created_at: string;
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

const STATUS_COLORS = {
  pago: "hsl(142, 71%, 45%)",
  pendente: "hsl(38, 92%, 50%)",
  quebrado: "hsl(0, 84%, 60%)",
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
  const navigate = useNavigate();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedOperator, setSelectedOperator] = useState("todos");
  const [selectedCredor, setSelectedCredor] = useState("todos");

  const { data: allClients = [] } = useQuery({
    queryKey: ["analytics-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*");
      if (error) throw error;
      return data as ClientRow[];
    },
    enabled: profile?.role === "admin",
  });

  const { data: operators = [] } = useQuery({
    queryKey: ["operators"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "operador");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: profile?.role === "admin",
  });

  const yearOptions = useMemo(generateYearOptions, []);
  const credores = useMemo(() => [...new Set(allClients.map((c) => c.credor))].sort(), [allClients]);

  const filteredClients = useMemo(() => {
    const year = parseInt(selectedYear);
    return allClients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      if (d.getFullYear() !== year) return false;
      if (selectedMonth !== "all" && d.getMonth() !== parseInt(selectedMonth)) return false;
      if (selectedOperator !== "todos" && c.operator_id !== selectedOperator) return false;
      if (selectedCredor !== "todos" && c.credor !== selectedCredor) return false;
      return true;
    });
  }, [allClients, selectedYear, selectedMonth, selectedOperator, selectedCredor]);

  const pagos = filteredClients.filter((c) => c.status === "pago");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");
  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);

  // KPIs
  const totalInadimplencia = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalPagosQuebrados = pagos.length + quebrados.length;
  const taxaRecuperacao = totalPagosQuebrados > 0 ? ((pagos.length / totalPagosQuebrados) * 100).toFixed(1) : "0";
  const ticketMedio = pagos.length > 0 ? totalRecebido / pagos.length : 0;

  // Portfolio conversion rate
  const contatados = filteredClients.filter((c) => c.operator_id != null);
  const convertidos = contatados.filter((c) => c.status === "pago");
  const taxaConversao = contatados.length > 0 ? (convertidos.length / contatados.length) * 100 : 0;

  // Evolution chart data
  const evolutionData = useMemo(() => {
    const year = parseInt(selectedYear);
    return monthLabels.map((label, monthIdx) => {
      const mc = allClients.filter((c) => {
        const d = parseISO(c.data_vencimento);
        if (d.getFullYear() !== year || d.getMonth() !== monthIdx) return false;
        if (selectedOperator !== "todos" && c.operator_id !== selectedOperator) return false;
        if (selectedCredor !== "todos" && c.credor !== selectedCredor) return false;
        return true;
      });
      return {
        name: label,
        recebido: mc.filter((c) => c.status === "pago").reduce((s, c) => s + Number(c.valor_pago), 0),
        quebra: mc.filter((c) => c.status === "quebrado").reduce((s, c) => s + Number(c.valor_parcela), 0),
        projetado: mc.reduce((s, c) => s + Number(c.valor_parcela), 0),
      };
    });
  }, [allClients, selectedYear, selectedOperator, selectedCredor]);

  // Status pie
  const statusPieData = [
    { name: "Pagos", value: pagos.length, color: STATUS_COLORS.pago },
    { name: "Pendentes", value: pendentes.length, color: STATUS_COLORS.pendente },
    { name: "Quebrados", value: quebrados.length, color: STATUS_COLORS.quebrado },
  ].filter((d) => d.value > 0);

  // Top 5 credores
  const top5Credores = useMemo(() => {
    const map = new Map<string, { credor: string; total: number }>();
    filteredClients.filter((c) => c.status === "pendente").forEach((c) => {
      if (!map.has(c.credor)) map.set(c.credor, { credor: c.credor, total: 0 });
      map.get(c.credor)!.total += Number(c.valor_parcela);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredClients]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    const counts = new Array(31).fill(0);
    filteredClients.forEach((c) => {
      const day = parseISO(c.data_vencimento).getDate();
      counts[day - 1] += 1;
    });
    const max = Math.max(...counts, 1);
    return counts.map((count, i) => ({ day: i + 1, count, intensity: count / max }));
  }, [filteredClients]);

  // Export
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredClients.map((c) => ({
      Nome: c.nome_completo, CPF: c.cpf, Credor: c.credor, Status: c.status,
      Valor: c.valor_parcela, Vencimento: c.data_vencimento,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analytics");
    XLSX.writeFile(wb, `analytics-${selectedYear}.xlsx`);
  };

  if (profile?.role !== "admin") {
    return <div className="text-center py-12 text-muted-foreground">Acesso restrito a administradores.</div>;
  }

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
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[75px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {monthNames.map((name, i) => <SelectItem key={i} value={i.toString()}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Op.</SelectItem>
                {operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name || "Sem nome"}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedCredor} onValueChange={setSelectedCredor}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Cred.</SelectItem>
                {credores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.print()} title="Exportar PDF">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
            <div className="absolute top-2 right-2"><InfoTooltip text="Soma dos valores de parcelas pendentes (em aberto) no período filtrado." /></div>
            <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Total Inadimplência</p>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalInadimplencia)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
            <div className="absolute top-2 right-2"><InfoTooltip text="Percentual de parcelas pagas em relação ao total de parcelas resolvidas (pagas + quebradas)." /></div>
            <Target className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Taxa de Recuperação</p>
            <p className="text-xl font-bold text-foreground">{taxaRecuperacao}%</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
            <div className="absolute top-2 right-2"><InfoTooltip text="Valor médio recebido por parcela paga no período." /></div>
            <Award className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Ticket Médio</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(ticketMedio)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm relative">
            <div className="absolute top-2 right-2"><InfoTooltip text="Soma de todos os valores efetivamente recebidos (status pago) no período." /></div>
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Total Recebido</p>
            <p className="text-xl font-bold text-success">{formatCurrency(totalRecebido)}</p>
          </div>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Evolution line chart */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
            <div className="absolute top-3 right-3"><InfoTooltip text="Evolução mês a mês do valor projetado, recebido e quebrado no ano selecionado." /></div>
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Evolução Mensal ({selectedYear})</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Legend />
                <Line type="monotone" dataKey="projetado" name="Projetado" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="recebido" name="Recebido" stroke={STATUS_COLORS.pago} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="quebra" name="Quebra" stroke={STATUS_COLORS.quebrado} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Portfolio conversion */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative flex flex-col">
            <div className="absolute top-3 right-3"><InfoTooltip text="De todos os clientes que tiveram contato (operador atribuído), qual percentual foi convertido (status pago)." /></div>
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Taxa de Conversão da Carteira</h3>
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <p className="text-5xl font-bold text-primary">{taxaConversao.toFixed(1)}%</p>
              <Progress value={taxaConversao} className="w-3/4 h-3" />
              <div className="flex gap-6 text-xs text-muted-foreground">
                <span>Contatados: <strong className="text-foreground">{contatados.length}</strong></span>
                <span>Convertidos: <strong className="text-foreground">{convertidos.length}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Status pie */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
            <div className="absolute top-3 right-3"><InfoTooltip text="Proporção visual entre parcelas pagas, pendentes e quebradas no período." /></div>
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Distribuição de Status</h3>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                    {statusPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(value: number, name: string) => [`${value} parcelas`, name]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
            )}
          </div>

          {/* Top 5 credores */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
            <div className="absolute top-3 right-3"><InfoTooltip text="Os 5 credores com maior valor total pendente na carteira filtrada." /></div>
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

          {/* Heatmap */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm relative">
            <div className="absolute top-3 right-3"><InfoTooltip text="Concentração de vencimentos por dia do mês. Quanto mais escuro, mais vencimentos naquele dia." /></div>
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
                  title={`Dia ${d.day}: ${d.count} vencimentos`}
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
