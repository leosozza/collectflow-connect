import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClients, Client } from "@/services/clientService";
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

const DashboardPage = () => {
  const { profile } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState("todos");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const { data: myGrade } = useQuery({
    queryKey: ["my-commission-grade", profile?.commission_grade_id],
    queryFn: async () => {
      if (!profile?.commission_grade_id) return null;
      const { data, error } = await supabase
        .from("commission_grades")
        .select("*")
        .eq("id", profile.commission_grade_id)
        .single();
      if (error) return null;
      return { ...data, tiers: data.tiers as unknown as CommissionTier[] } as CommissionGrade;
    },
    enabled: !!profile?.commission_grade_id,
  });

  const monthOptions = useMemo(generateMonthOptions, []);

  const filteredClients = useMemo(() => {
    if (selectedMonth === "todos") return clients;
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    return clients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      return d >= start && d <= end;
    });
  }, [clients, selectedMonth]);

  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const pagos = filteredClients.filter((c) => c.status === "pago" || c.status === "quebrado");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");

  const totalProjetado = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = pagos.reduce((s, c) => s + Number(c.quebra), 0);

  // Calculate commission using tiered grade if available, fallback to fixed rate
  const tiers = myGrade?.tiers;
  const { rate: commissionRate, commission: comissao } = tiers
    ? calculateTieredCommission(totalRecebido, tiers)
    : { rate: profile?.commission_rate || 0, commission: totalRecebido * ((profile?.commission_rate || 0) / 100) };

  const totalAReceber = totalRecebido - comissao;
  const pctQuebras = pagos.length > 0 ? ((quebrados.length / pagos.length) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Bem-vindo, {profile?.full_name || "Operador"}
          </p>
        </div>
        <div className="space-y-1.5 min-w-[200px]">
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
