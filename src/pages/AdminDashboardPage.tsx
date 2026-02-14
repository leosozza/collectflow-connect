import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { calculateTieredCommission, CommissionGrade, CommissionTier } from "@/lib/commission";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import {
  CalendarClock, ChevronLeft, ChevronRight, Users, Wallet, BarChart3,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

const AdminDashboardPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString());
  const [selectedOperator, setSelectedOperator] = useState<string>("todos");
  const [browseDate, setBrowseDate] = useState(new Date());

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
    const { rate, commission } = getOperatorCommission(op, opRecebido);
    return {
      ...op,
      totalRecebido: opRecebido,
      totalQuebra: opQuebra,
      comissao: commission,
      commissionRate: rate,
      totalClients: opClients.length,
    };
  });

  const totalComissoes = operatorStats.reduce((s, op) => s + op.comissao, 0);

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
          <Button size="sm" onClick={() => navigate("/analytics")} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <BarChart3 className="w-4 h-4 mr-1" />
            Analytics
          </Button>
          <Button size="sm" onClick={() => navigate("/relatorios")} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <BarChart3 className="w-4 h-4 mr-1" />
            Relatórios
          </Button>
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

      {/* Vencimentos strip */}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Quebra" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="Pendentes" value={formatCurrency(totalEmAberto)} icon="receivable" />
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

    </div>
  );
};

export default AdminDashboardPage;
