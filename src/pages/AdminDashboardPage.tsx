import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  commission_rate: number;
}

interface ClientRow {
  operator_id: string | null;
  valor_parcela: number;
  valor_pago: number;
  quebra: number;
  status: string;
  data_vencimento: string;
}

const AdminDashboardPage = () => {
  const { profile } = useAuth();
  const [selectedOperator, setSelectedOperator] = useState<string>("todos");

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

  // Filter clients based on selected operator
  const filteredClients =
    selectedOperator === "todos"
      ? allClients
      : allClients.filter((c) => c.operator_id === selectedOperator);

  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const pagos = filteredClients.filter((c) => c.status === "pago" || c.status === "quebrado");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");

  const totalProjetado = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = pagos.reduce((s, c) => s + Number(c.quebra), 0);
  const pctQuebras = pagos.length > 0 ? ((quebrados.length / pagos.length) * 100).toFixed(1) : "0";

  // Find selected operator's commission for individual view
  const selectedOp = operators.find((op) => op.id === selectedOperator);
  const commissionRate = selectedOp?.commission_rate || 0;
  const comissao = selectedOperator !== "todos" ? totalRecebido * (commissionRate / 100) : 0;
  const totalAReceber = selectedOperator !== "todos" ? totalRecebido - comissao : 0;

  // Per-operator stats (always show full breakdown)
  const operatorStats = operators.map((op) => {
    const opClients = allClients.filter((c) => c.operator_id === op.id);
    const opPagos = opClients.filter((c) => c.status === "pago" || c.status === "quebrado");
    const opRecebido = opPagos.reduce((s, c) => s + Number(c.valor_pago), 0);
    const opQuebra = opPagos.reduce((s, c) => s + Number(c.quebra), 0);
    const opPendente = opClients.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor_parcela), 0);
    const opComissao = opRecebido * (op.commission_rate / 100);

    return {
      ...op,
      totalRecebido: opRecebido,
      totalQuebra: opQuebra,
      totalPendente: opPendente,
      comissao: opComissao,
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

        <div className="space-y-1.5 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">Filtrar por Operador</Label>
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

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${selectedOperator !== "todos" ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
        <StatCard title="Total Projetado" value={formatCurrency(totalProjetado)} icon="projected" />
        <StatCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Total Quebrado" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="% de Quebras" value={`${pctQuebras}%`} icon="percent" />
        {selectedOperator !== "todos" && (
          <>
            <StatCard title={`Comissão (${commissionRate}%)`} value={formatCurrency(comissao)} icon="commission" />
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
                    <td className="px-5 py-3 text-sm text-right">{op.commission_rate}%</td>
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
