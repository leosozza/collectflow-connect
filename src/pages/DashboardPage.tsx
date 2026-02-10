import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClients, Client, markAsPaid } from "@/services/clientService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { calculateTieredCommission, CommissionGrade, CommissionTier } from "@/lib/commission";
import StatCard from "@/components/StatCard";
import PaymentDialog from "@/components/clients/PaymentDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CreditCard, CalendarClock } from "lucide-react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const generateYearOptions = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 3; i++) {
    years.push(now.getFullYear() - i);
  }
  return years;
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DashboardPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth()]);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);

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

  const paymentMutation = useMutation({
    mutationFn: ({ client, valor }: { client: Client; valor: number }) =>
      markAsPaid(client, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Pagamento registrado!");
      setPaymentClient(null);
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const yearOptions = useMemo(generateYearOptions, []);

  const toggleMonth = (monthIndex: number) => {
    setSelectedMonths((prev) =>
      prev.includes(monthIndex)
        ? prev.filter((m) => m !== monthIndex)
        : [...prev, monthIndex]
    );
  };

  const filteredClients = useMemo(() => {
    if (selectedMonths.length === 0) return clients;
    const year = parseInt(selectedYear);
    return clients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      return d.getFullYear() === year && selectedMonths.includes(d.getMonth());
    });
  }, [clients, selectedYear, selectedMonths]);

  // Today's due clients
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayClients = useMemo(() => {
    return clients.filter((c) => c.status === "pendente" && c.data_vencimento === todayStr);
  }, [clients, todayStr]);

  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const pagos = filteredClients.filter((c) => c.status === "pago");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");

  const totalProjetado = filteredClients.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = quebrados.reduce((s, c) => s + Number(c.valor_parcela), 0);
  // Total a receber = parcelas pendentes (que ainda não foram pagas nem quebradas)
  const totalAReceber = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);

  const totalPagosQuebrados = pagos.length + quebrados.length;
  const pctRecebidos = totalPagosQuebrados > 0 ? ((pagos.length / totalPagosQuebrados) * 100).toFixed(1) : "0";
  const pctQuebras = totalPagosQuebrados > 0 ? ((quebrados.length / totalPagosQuebrados) * 100).toFixed(1) : "0";

  // Commission
  const tiers = myGrade?.tiers;
  const { rate: commissionRate, commission: comissao } = tiers
    ? calculateTieredCommission(totalRecebido, tiers)
    : { rate: profile?.commission_rate || 0, commission: totalRecebido * ((profile?.commission_rate || 0) / 100) };

  const periodLabel = selectedMonths.length > 0
    ? selectedMonths.map((m) => monthNames[m]).join(", ") + ` ${selectedYear}`
    : "Selecione um período";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Bem-vindo, {profile?.full_name || "Operador"}
          </p>
        </div>
      </div>

      {/* Period filter: Year + Month checkboxes */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="space-y-1.5 min-w-[120px]">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {monthNames.map((name, i) => (
            <label
              key={i}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                selectedMonths.includes(i)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              <Checkbox
                checked={selectedMonths.includes(i)}
                onCheckedChange={() => toggleMonth(i)}
                className="hidden"
              />
              {name.slice(0, 3)}
            </label>
          ))}
        </div>
      </div>

      {/* Main stat: Total Projetado centered */}
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <StatCard title="Total Projetado no Mês" value={formatCurrency(totalProjetado)} icon="projected" />
        </div>
      </div>

      {/* Row 2: Recebido, Quebra, A Receber */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Total de Quebra" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="Total a Receber" value={formatCurrency(totalAReceber)} icon="receivable" />
      </div>

      {/* Row 3: % Recebidos, % Quebras, Comissão */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="% de Recebidos" value={`${pctRecebidos}%`} icon="received" />
        <StatCard title="% de Quebras" value={`${pctQuebras}%`} icon="percent" />
        <StatCard title={`Comissão a Receber (${commissionRate}%)`} value={formatCurrency(comissao)} icon="commission" />
      </div>

      {/* Today's due clients table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-card-foreground">Vencimentos de Hoje</h2>
          <span className="ml-auto text-sm text-muted-foreground">{todayClients.length} registros</span>
        </div>

        {todayClients.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Nenhum vencimento para hoje
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Credor</TableHead>
                  <TableHead className="text-center">Parcela</TableHead>
                  <TableHead className="text-right">Valor da Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-card-foreground">{client.nome_completo}</TableCell>
                    <TableCell className="text-muted-foreground">{client.cpf}</TableCell>
                    <TableCell className="text-muted-foreground">{client.credor}</TableCell>
                    <TableCell className="text-center">{client.numero_parcela}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(client.valor_parcela))}</TableCell>
                    <TableCell>{formatDate(client.data_vencimento)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-success hover:text-success gap-1"
                        onClick={() => setPaymentClient(client)}
                      >
                        <CreditCard className="w-4 h-4" />
                        Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PaymentDialog
        client={paymentClient}
        onClose={() => setPaymentClient(null)}
        onConfirm={(valor) => {
          if (paymentClient) {
            paymentMutation.mutate({ client: paymentClient, valor });
          }
        }}
        submitting={paymentMutation.isPending}
      />
    </div>
  );
};

export default DashboardPage;
