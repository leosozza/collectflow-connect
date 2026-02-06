import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";

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

  const pendentes = allClients.filter((c) => c.status === "pendente");
  const pagos = allClients.filter((c) => c.status === "pago" || c.status === "quebrado");
  const quebrados = allClients.filter((c) => c.status === "quebrado");

  const totalProjetado = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = pagos.reduce((s, c) => s + Number(c.quebra), 0);
  const pctQuebras = pagos.length > 0 ? ((quebrados.length / pagos.length) * 100).toFixed(1) : "0";

  // Per-operator stats
  const operatorStats = operators.map((op) => {
    const opClients = allClients.filter((c) => c.operator_id === op.id);
    const opPagos = opClients.filter((c) => c.status === "pago" || c.status === "quebrado");
    const opRecebido = opPagos.reduce((s, c) => s + Number(c.valor_pago), 0);
    const opQuebra = opPagos.reduce((s, c) => s + Number(c.quebra), 0);
    const opPendente = opClients.filter((c) => c.status === "pendente").reduce((s, c) => s + Number(c.valor_parcela), 0);
    const comissao = opRecebido * (op.commission_rate / 100);

    return {
      ...op,
      totalRecebido: opRecebido,
      totalQuebra: opQuebra,
      totalPendente: opPendente,
      comissao,
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-muted-foreground text-sm">Visão consolidada de todos operadores</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Projetado" value={formatCurrency(totalProjetado)} icon="projected" />
        <StatCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Total Quebrado" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="% de Quebras" value={`${pctQuebras}%`} icon="percent" />
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
                  <th className="px-5 py-3 text-right font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {operatorStats.map((op) => (
                  <tr key={op.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-card-foreground">{op.full_name || "Sem nome"}</td>
                    <td className="px-5 py-3 text-sm text-right">{op.totalClients}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatCurrency(op.totalPendente)}</td>
                    <td className="px-5 py-3 text-sm text-right text-success">{formatCurrency(op.totalRecebido)}</td>
                    <td className="px-5 py-3 text-sm text-right text-destructive">{formatCurrency(op.totalQuebra)}</td>
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
