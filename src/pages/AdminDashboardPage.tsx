import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { calculateTieredCommission, CommissionGrade, CommissionTier } from "@/lib/commission";
import StatCard from "@/components/StatCard";
import PaymentDialog from "@/components/clients/PaymentDialog";
import { markAsPaid, markAsBroken, Client } from "@/services/clientService";
import { Button } from "@/components/ui/button";
import {
  CalendarClock, ChevronLeft, ChevronRight, TrendingUp, Users, Wallet,
  BarChart3, PieChart as PieChartIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  commission_rate: number;
  commission_grade_id: string | null;
}

interface ClientRow {
  id: string;
  operator_id: string | null;
  valor_parcela: number;
  valor_pago: number;
  quebra: number;
  status: string;
  data_vencimento: string;
  nome_completo: string;
  cpf: string;
  credor: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  created_at: string;
  updated_at: string;
}

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

const STATUS_COLORS = {
  pago: "hsl(142, 71%, 45%)",
  pendente: "hsl(38, 92%, 50%)",
  quebrado: "hsl(0, 84%, 60%)",
};

const AdminDashboardPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString());
  const [selectedOperator, setSelectedOperator] = useState<string>("todos");
  const [browseDate, setBrowseDate] = useState(new Date());
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);

  const { data: allClients = [] } = useQuery({
    queryKey: ["admin-clients"],
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

  const { data: grades = [] } = useQuery({
    queryKey: ["commission-grades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_grades").select("*");
      if (error) throw error;
      return (data || []).map((d) => ({ ...d, tiers: d.tiers as unknown as CommissionTier[] })) as CommissionGrade[];
    },
    enabled: profile?.role === "admin",
  });

  const paymentMutation = useMutation({
    mutationFn: ({ client, valor }: { client: Client; valor: number }) => markAsPaid(client, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Pagamento registrado!");
      setPaymentClient(null);
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const breakMutation = useMutation({
    mutationFn: (client: Client) => markAsBroken(client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Quebra registrada!");
    },
    onError: () => toast.error("Erro ao registrar quebra"),
  });

  const yearOptions = useMemo(generateYearOptions, []);

  const monthFilteredClients = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    return allClients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [allClients, selectedYear, selectedMonth]);

  const filteredClients =
    selectedOperator === "todos"
      ? monthFilteredClients
      : monthFilteredClients.filter((c) => c.operator_id === selectedOperator);

  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const pagos = filteredClients.filter((c) => c.status === "pago");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");

  const totalProjetado = filteredClients.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = quebrados.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalEmAberto = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);

  const totalPagosQuebrados = pagos.length + quebrados.length;
  const pctRecebidos = totalPagosQuebrados > 0 ? ((pagos.length / totalPagosQuebrados) * 100).toFixed(1) : "0";
  const pctQuebras = totalPagosQuebrados > 0 ? ((quebrados.length / totalPagosQuebrados) * 100).toFixed(1) : "0";

  const selectedOp = operators.find((op) => op.id === selectedOperator);
  const getOperatorCommission = (op: Profile, received: number) => {
    const grade = grades.find((g) => g.id === op.commission_grade_id);
    if (grade) return calculateTieredCommission(received, grade.tiers as CommissionTier[]);
    return { rate: op.commission_rate, commission: received * (op.commission_rate / 100) };
  };

  // Browse date for vencimentos
  const browseDateStr = format(browseDate, "yyyy-MM-dd");
  const browseClients = useMemo(() => {
    const base = selectedOperator === "todos"
      ? allClients
      : allClients.filter((c) => c.operator_id === selectedOperator);
    return base.filter((c) => c.data_vencimento === browseDateStr);
  }, [allClients, selectedOperator, browseDateStr]);

  const navigateDate = (dir: number) => {
    setBrowseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir);
      return d;
    });
  };

  // Per-operator stats
  const operatorStats = operators.map((op) => {
    const opClients = monthFilteredClients.filter((c) => c.operator_id === op.id);
    const opPagos = opClients.filter((c) => c.status === "pago");
    const opRecebido = opPagos.reduce((s, c) => s + Number(c.valor_pago), 0);
    const opQuebra = opClients.filter((c) => c.status === "quebrado").reduce((s, c) => s + Number(c.valor_parcela), 0);
    const opPendente = opClients.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor_parcela), 0);
    const { rate, commission } = getOperatorCommission(op, opRecebido);
    return {
      ...op,
      totalRecebido: opRecebido,
      totalQuebra: opQuebra,
      totalPendente: opPendente,
      comissao: commission,
      commissionRate: rate,
      totalClients: opClients.length,
    };
  });

  // Total commission across all operators
  const totalComissoes = operatorStats.reduce((s, op) => s + op.comissao, 0);

  // Pie chart data
  const statusPieData = [
    { name: "Pagos", value: pagos.length, color: STATUS_COLORS.pago },
    { name: "Pendentes", value: pendentes.length, color: STATUS_COLORS.pendente },
    { name: "Quebrados", value: quebrados.length, color: STATUS_COLORS.quebrado },
  ].filter((d) => d.value > 0);

  // Bar chart data - operator performance
  const operatorBarData = operatorStats.map((op) => ({
    name: (op.full_name || "").split(" ")[0],
    recebido: op.totalRecebido,
    quebra: op.totalQuebra,
    pendente: op.totalPendente,
  }));

  if (profile?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground text-sm">
            {selectedOperator === "todos"
              ? "Visão consolidada de todos operadores"
              : `Visualizando: ${selectedOp?.full_name || "Operador"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {operators.map((op) => (
                <SelectItem key={op.id} value={op.id}>
                  {op.full_name || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[85px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[115px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((name, i) => (
                <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Hero card: Total Projetado */}
      <div className="gradient-orange rounded-xl p-5 text-center shadow-lg">
        <p className="text-xs font-medium text-primary-foreground/80 mb-1 uppercase tracking-wider">Total Projetado no Mês</p>
        <p className="text-3xl font-extrabold text-primary-foreground tracking-tight">{formatCurrency(totalProjetado)}</p>
        <p className="text-xs text-primary-foreground/70 mt-1">{filteredClients.length} parcelas no período</p>
      </div>

      {/* Vencimentos strip - header only */}
      <div className="bg-card rounded-xl border border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-card-foreground">Vencimentos</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[110px] text-center px-2 py-1 rounded-md bg-primary/10 text-primary">
            {format(browseDate, "dd/MM/yyyy")}
          </span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigateDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-foreground">{browseClients.length}</span>
          <span className="text-xs text-muted-foreground ml-1">registros</span>
          <span className="text-xs text-muted-foreground mx-1">•</span>
          <span className="text-sm font-bold text-primary">{formatCurrency(browseClients.reduce((s, c) => s + Number(c.valor_parcela), 0))}</span>
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Quebra" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="Pendentes" value={formatCurrency(totalEmAberto)} icon="receivable" />
        <StatCard title="Comissões a Pagar" value={formatCurrency(totalComissoes)} icon="commission" />
      </div>

      {/* Percentages row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">% Recebidos</p>
          <p className="text-xl font-bold text-success">{pctRecebidos}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">% Quebras</p>
          <p className="text-xl font-bold text-destructive">{pctQuebras}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Clientes</p>
          <p className="text-xl font-bold text-foreground">{filteredClients.length}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Pie Chart */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <PieChartIcon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">Distribuição por Status</h3>
          </div>
          {statusPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} parcelas`, name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Sem dados no período
            </div>
          )}
        </div>

        {/* Operator Bar Chart */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">Recebimento por Operador</h3>
          </div>
          {operatorBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={operatorBarData} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "recebido" ? "Recebido" : name === "quebra" ? "Quebra" : "Pendente",
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="recebido" fill={STATUS_COLORS.pago} radius={[4, 4, 0, 0]} />
                <Bar dataKey="quebra" fill={STATUS_COLORS.quebrado} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendente" fill={STATUS_COLORS.pendente} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Sem operadores cadastrados
            </div>
          )}
        </div>
      </div>

      {/* Operators breakdown table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Desempenho por Operador</h2>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Wallet className="w-3.5 h-3.5" />
            <span>Total comissões: <strong className="text-warning">{formatCurrency(totalComissoes)}</strong></span>
          </div>
        </div>
        {operatorStats.length === 0 ? (
          <div className="p-5 text-center text-muted-foreground text-sm">
            Nenhum operador cadastrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Operador</th>
                  <th className="px-4 py-2.5 text-right font-medium">Clientes</th>
                  <th className="px-4 py-2.5 text-right font-medium">Projetado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Recebido</th>
                  <th className="px-4 py-2.5 text-right font-medium">Quebra</th>
                  <th className="px-4 py-2.5 text-right font-medium">Comissão (%)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Comissão (R$)</th>
                </tr>
              </thead>
              <tbody>
                {operatorStats.map((op) => (
                  <tr
                    key={op.id}
                    className={`border-t border-border transition-colors cursor-pointer ${
                      selectedOperator === op.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedOperator(selectedOperator === op.id ? "todos" : op.id)}
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-card-foreground">{op.full_name || "Sem nome"}</td>
                    <td className="px-4 py-2.5 text-sm text-right">{op.totalClients}</td>
                    <td className="px-4 py-2.5 text-sm text-right">{formatCurrency(op.totalPendente)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-success">{formatCurrency(op.totalRecebido)}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-destructive">{formatCurrency(op.totalQuebra)}</td>
                    <td className="px-4 py-2.5 text-sm text-right">{op.commissionRate}%</td>
                    <td className="px-4 py-2.5 text-sm text-right text-warning">{formatCurrency(op.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentDialog
        client={paymentClient}
        onClose={() => setPaymentClient(null)}
        onConfirm={(valor) => {
          if (paymentClient) paymentMutation.mutate({ client: paymentClient, valor });
        }}
        submitting={paymentMutation.isPending}
      />
    </div>
  );
};

export default AdminDashboardPage;
