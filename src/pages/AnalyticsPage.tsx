import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, Target, Clock, Award, TrendingUp } from "lucide-react";
import { parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
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
  const totalPagosQuebrados = pagos.length + quebrados.length;
  const taxaRecuperacao = totalPagosQuebrados > 0 ? ((pagos.length / totalPagosQuebrados) * 100).toFixed(1) : "0";
  const ticketMedio = pagos.length > 0 ? totalRecebido / pagos.length : 0;

  const paidOnTime = pagos.filter((c) => {
    const updated = new Date(c.updated_at || c.data_vencimento);
    const due = new Date(c.data_vencimento);
    return updated <= new Date(due.getTime() + 86400000);
  }).length;
  const tempoMedioLabel = pagos.length > 0 ? `${((paidOnTime / pagos.length) * 100).toFixed(0)}% no prazo` : "N/A";

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

  // Operator conversion rate
  const operatorConversion = useMemo(() => {
    return operators.map((op) => {
      const opClients = filteredClients.filter((c) => c.operator_id === op.id);
      const opPagos = opClients.filter((c) => c.status === "pago").length;
      const opResolved = opPagos + opClients.filter((c) => c.status === "quebrado").length;
      const rate = opResolved > 0 ? (opPagos / opResolved) * 100 : 0;
      return { name: (op.full_name || "").split(" ")[0], taxa: parseFloat(rate.toFixed(1)), total: opClients.length };
    }).filter((o) => o.total > 0).sort((a, b) => b.taxa - a.taxa);
  }, [operators, filteredClients]);

  // Status pie
  const statusPieData = [
    { name: "Pagos", value: pagos.length, color: STATUS_COLORS.pago },
    { name: "Pendentes", value: pendentes.length, color: STATUS_COLORS.pendente },
    { name: "Quebrados", value: quebrados.length, color: STATUS_COLORS.quebrado },
  ].filter((d) => d.value > 0);

  // Top 5 devedores
  const top5 = useMemo(() => {
    const map = new Map<string, { nome: string; cpf: string; total: number }>();
    filteredClients.filter((c) => c.status === "pendente").forEach((c) => {
      const key = c.cpf;
      if (!map.has(key)) map.set(key, { nome: c.nome_completo, cpf: c.cpf, total: 0 });
      map.get(key)!.total += Number(c.valor_parcela);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredClients]);

  // Heatmap data: day of month → count
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
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted-foreground text-sm">Painel analítico detalhado</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[85px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[115px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {monthNames.map((name, i) => <SelectItem key={i} value={i.toString()}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Op.</SelectItem>
              {operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name || "Sem nome"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedCredor} onValueChange={setSelectedCredor}>
            <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Cred.</SelectItem>
              {credores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
          <Target className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Taxa de Recuperação</p>
          <p className="text-xl font-bold text-foreground">{taxaRecuperacao}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
          <Award className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Ticket Médio</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(ticketMedio)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
          <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Tempo Médio Cobrança</p>
          <p className="text-xl font-bold text-foreground">{tempoMedioLabel}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
          <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Total Recebido</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalRecebido)}</p>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolution line chart */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Evolução Mensal ({selectedYear})</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              <Legend />
              <Line type="monotone" dataKey="projetado" name="Projetado" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="recebido" name="Recebido" stroke={STATUS_COLORS.pago} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="quebra" name="Quebra" stroke={STATUS_COLORS.quebrado} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Operator conversion bar chart */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Taxa de Conversão por Operador</h3>
          {operatorConversion.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={operatorConversion} layout="vertical" barSize={18}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(value: number) => `${value}%`} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Bar dataKey="taxa" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status pie */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Distribuição de Status</h3>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                  {statusPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} parcelas`, name]} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
          )}
        </div>

        {/* Top 5 devedores */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Top 5 Maiores Devedores</h3>
          {top5.length > 0 ? (
            <div className="space-y-2">
              {top5.map((d, i) => (
                <div key={d.cpf} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary w-5">{i + 1}.</span>
                    <div>
                      <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{d.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{d.cpf}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-destructive">{formatCurrency(d.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">Sem devedores pendentes</div>
          )}
        </div>

        {/* Heatmap */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Heatmap de Vencimentos (dia do mês)</h3>
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
  );
};

export default AnalyticsPage;
