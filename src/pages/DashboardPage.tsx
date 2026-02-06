import { useQuery } from "@tanstack/react-query";
import { fetchClients, Client } from "@/services/clientService";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";


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
    </div>
  );
};

export default DashboardPage;
