import { useQuery } from "@tanstack/react-query";
import { fetchClients, Client } from "@/services/clientService";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";
import { AlertTriangle } from "lucide-react";

const DashboardPage = () => {
  const { profile } = useAuth();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const pendentes = clients.filter((c) => c.status === "pendente");
  const pagos = clients.filter((c) => c.status === "pago" || c.status === "quebrado");
  const quebrados = clients.filter((c) => c.status === "quebrado");

  const totalProjetado = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = pagos.reduce((s, c) => s + Number(c.quebra), 0);
  const commissionRate = profile?.commission_rate || 0;
  const comissao = totalRecebido * (commissionRate / 100);
  const totalAReceber = totalRecebido - comissao;
  const pctQuebras = pagos.length > 0 ? ((quebrados.length / pagos.length) * 100).toFixed(1) : "0";

  const inadimplentes = pendentes.filter((c) => {
    const venc = new Date(c.data_vencimento + "T00:00:00");
    return venc < new Date();
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Bem-vindo, {profile?.full_name || "Operador"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Projetado" value={formatCurrency(totalProjetado)} icon="projected" />
        <StatCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Total Quebrado" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title={`Comissão (${commissionRate}%)`} value={formatCurrency(comissao)} icon="commission" />
        <StatCard title="Total a Receber" value={formatCurrency(totalAReceber)} icon="receivable" />
        <StatCard title="% de Quebras" value={`${pctQuebras}%`} icon="percent" />
      </div>

      {/* Inadimplentes */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="font-semibold text-card-foreground">Clientes Inadimplentes</h2>
          <span className="ml-auto text-sm text-muted-foreground">{inadimplentes.length} registros</span>
        </div>
        {inadimplentes.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Nenhum cliente inadimplente no momento
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-5 py-3 text-left font-medium">Nome</th>
                  <th className="px-5 py-3 text-left font-medium">CPF</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                  <th className="px-5 py-3 text-left font-medium">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {inadimplentes.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-card-foreground">{c.nome_completo}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{c.cpf}</td>
                    <td className="px-5 py-3 text-sm text-right">{formatCurrency(Number(c.valor_parcela))}</td>
                    <td className="px-5 py-3 text-sm text-destructive">
                      {new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
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

export default DashboardPage;
