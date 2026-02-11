import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { parseISO } from "date-fns";

interface EvolutionChartProps {
  clients: Client[];
  year: number;
}

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const EvolutionChart = ({ clients, year }: EvolutionChartProps) => {
  const data = useMemo(() => {
    return monthLabels.map((label, monthIdx) => {
      const monthClients = clients.filter((c) => {
        const d = parseISO(c.data_vencimento);
        return d.getFullYear() === year && d.getMonth() === monthIdx;
      });
      const recebido = monthClients
        .filter((c) => c.status === "pago")
        .reduce((s, c) => s + Number(c.valor_pago), 0);
      const quebra = monthClients
        .filter((c) => c.status === "quebrado")
        .reduce((s, c) => s + Number(c.valor_parcela), 0);
      const projetado = monthClients.reduce((s, c) => s + Number(c.valor_parcela), 0);
      return { name: label, recebido, quebra, projetado };
    });
  }, [clients, year]);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Evolução Mensal ({year})</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
          <Legend />
          <Line type="monotone" dataKey="projetado" name="Projetado" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="recebido" name="Recebido" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="quebra" name="Quebra" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EvolutionChart;
