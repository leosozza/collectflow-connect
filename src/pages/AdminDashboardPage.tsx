import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { calculateTieredCommission, CommissionGrade, CommissionTier } from "@/lib/commission";
import StatCard from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  commission_rate: number;
  commission_grade_id: string | null;
}

interface ClientRow {
  operator_id: string | null;
  valor_parcela: number;
  valor_pago: number;
  quebra: number;
  status: string;
  data_vencimento: string;
}

const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = [
    { value: "todos", label: "Todos os períodos" },
  ];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = format(d, "yyyy-MM");
    const label = format(d, "MMMM yyyy", { locale: ptBR });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
};

const AdminDashboardPage = () => {
  const { profile } = useAuth();
  const [selectedOperator, setSelectedOperator] = useState<string>("todos");
  const [selectedMonth, setSelectedMonth] = useState<string>("todos");

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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "operador");
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

  const monthOptions = useMemo(generateMonthOptions, []);

  // Filter by month
  const monthFilteredClients = useMemo(() => {
    if (selectedMonth === "todos") return allClients;
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    return allClients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      return d >= start && d <= end;
    });
  }, [allClients, selectedMonth]);

  // Filter by operator
  const filteredClients =
    selectedOperator === "todos"
      ? monthFilteredClients
      : monthFilteredClients.filter((c) => c.operator_id === selectedOperator);

  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const pagos = filteredClients.filter((c) => c.status === "pago" || c.status === "quebrado");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");

  const totalProjetado = filteredClients.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = pagos.reduce((s, c) => s + Number(c.quebra), 0);
  const pctQuebras = pagos.length > 0 ? ((quebrados.length / pagos.length) * 100).toFixed(1) : "0";

  // Commission for selected operator
  const selectedOp = operators.find((op) => op.id === selectedOperator);
  const getOperatorCommission = (op: Profile, received: number) => {
    const grade = grades.find((g) => g.id === op.commission_grade_id);
    if (grade) {
      return calculateTieredCommission(received, grade.tiers as CommissionTier[]);
    }
    return {
      rate: op.commission_rate,
      commission: received * (op.commission_rate / 100),
    };
  };

  const selectedCommission = selectedOp
    ? getOperatorCommission(selectedOp, totalRecebido)
    : { rate: 0, commission: 0 };
  const totalAReceber = selectedOperator !== "todos" ? totalRecebido - selectedCommission.commission : 0;

  // Per-operator stats
  const operatorStats = operators.map((op) => {
    const opClients = monthFilteredClients.filter((c) => c.operator_id === op.id);
    const opPagos = opClients.filter((c) => c.status === "pago" || c.status === "quebrado");
    const opRecebido = opPagos.reduce((s, c) => s + Number(c.valor_pago), 0);
    const opQuebra = opPagos.reduce((s, c) => s + Number(c.quebra), 0);
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

  if (profile?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground text-sm">
            {selectedOperator === "todos"
              ? "Visão consolidada de todos operadores"
              : `Visualizando: ${selectedOp?.full_name || "Operador"}`}
          </p>
        </div>

        <div className="flex gap-3">
          <div className="space-y-1.5 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Operador</Label>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Operadores</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.full_name || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedOperator !== "todos" ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
        <StatCard title="Total Projetado" value={formatCurrency(totalProjetado)} icon="projected" />
        <StatCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Total Quebrado" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="% de Quebras" value={`${pctQuebras}%`} icon="percent" />
        {selectedOperator !== "todos" && (
          <>
            <StatCard title={`Comissão (${selectedCommission.rate}%)`} value={formatCurrency(selectedCommission.commission)} icon="commission" />
            <StatCard title="Total a Receber" value={formatCurrency(totalAReceber)} icon="receivable" />
          </>
        )}
      </div>

      {/* Operators breakdown */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-card-foreground">Desempenho por Operador</h2>
        </div>
        {operatorStats.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Nenhum operador cadastrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-5 py-3 text-left font-medium">Operador</th>
                  <th className="px-5 py-3 text-right font-medium">Clientes</th>
                  <th className="px-5 py-3 text-right font-medium">Projetado</th>
                  <th className="px-5 py-3 text-right font-medium">Recebido</th>
                  <th className="px-5 py-3 text-right font-medium">Quebra</th>
                  <th className="px-5 py-3 text-right font-medium">Comissão (%)</th>
                  <th className="px-5 py-3 text-right font-medium">Comissão (R$)</th>
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
                    onClick={() =>
                      setSelectedOperator(selectedOperator === op.id ? "todos" : op.id)
                    }
                  >
                    <td className="px-5 py-3 text-sm font-medium text-card-foreground">{op.full_name || "Sem nome"}</td>
                    <td className="px-5 py-3 text-sm text-right">{op.totalClients}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatCurrency(op.totalPendente)}</td>
                    <td className="px-5 py-3 text-sm text-right text-success">{formatCurrency(op.totalRecebido)}</td>
                    <td className="px-5 py-3 text-sm text-right text-destructive">{formatCurrency(op.totalQuebra)}</td>
                    <td className="px-5 py-3 text-sm text-right">{op.commissionRate}%</td>
                    <td className="px-5 py-3 text-sm text-right text-warning">{formatCurrency(op.comissao)}</td>
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
