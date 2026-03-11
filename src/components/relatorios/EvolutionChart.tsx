import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { parseISO } from "date-fns";

interface Agreement {
  id: string;
  proposed_total: number;
  status: string;
  created_at: string;
}

interface EvolutionChartProps {
  agreements: Agreement[];
  year: number;
}

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const EvolutionChart = ({ agreements, year }: EvolutionChartProps) => {
  const data = useMemo(() => {
    return monthLabels.map((label, monthIdx) => {
      const monthAgreements = agreements.filter((a) => {
        const d = parseISO(a.created_at);
        return d.getFullYear() === year && d.getMonth() === monthIdx;
      });
      const negociado = monthAgreements
        .filter((a) => a.status !== "cancelled" && a.status !== "rejected")
        .reduce((s, a) => s + Number(a.proposed_total), 0);
      const recebido = monthAgreements
        .filter((a) => a.status === "completed")
        .reduce((s, a) => s + Number(a.proposed_total), 0);
      const quebra = monthAgreements
        .filter((a) => a.status === "cancelled")
        .reduce((s, a) => s + Number(a.proposed_total), 0);
      return { name: label, negociado, recebido, quebra };
    });
  }, [agreements, year]);

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
          <Line type="monotone" dataKey="negociado" name="Negociado" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="recebido" name="Recebido" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="quebra" name="Quebra" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EvolutionChart;
