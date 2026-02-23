import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClients, Client } from "@/services/clientService";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronLeft, ChevronRight, CheckCircle2, XCircle, BarChart3, FileText } from "lucide-react";
import { format, parseISO, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { markAsPaid, markAsBroken } from "@/services/clientService";
import PaymentDialog from "@/components/clients/PaymentDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MultiSelect } from "@/components/ui/multi-select";
import { useNavigate } from "react-router-dom";
import MiniRanking from "@/components/dashboard/MiniRanking";
import { usePermissions } from "@/hooks/usePermissions";
import { useGamification } from "@/hooks/useGamification";

const generateYearOptions = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 3; i++) years.push(now.getFullYear() - i);
  return years;
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DashboardPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const { checkAndGrantAchievements } = useGamification();
  const permissions = usePermissions();

  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [browseDate, setBrowseDate] = useState(new Date());

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["dashboard-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, created_at, created_by, status");
      if (error) throw error;
      return data || [];
    },
  });

  const canViewAll = permissions.canViewAllDashboard;
  const todayStr = format(now, "yyyy-MM-dd");

  const filteredAgreements = useMemo(() => {
    let items = agreements;
    if (!canViewAll && profile?.user_id) {
      items = items.filter(a => a.created_by === profile.user_id);
    }
    return items;
  }, [agreements, canViewAll, profile?.user_id]);

  const acordosDia = useMemo(() =>
    filteredAgreements.filter(a => a.created_at.startsWith(todayStr)).length,
    [filteredAgreements, todayStr]
  );

  const acordosMes = useMemo(() => {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    return filteredAgreements.filter(a => {
      const d = new Date(a.created_at);
      return d >= monthStart && d <= monthEnd;
    }).length;
  }, [filteredAgreements]);

  // Compute month stats for gamification context
  const computeMonthStats = () => {
    const y = now.getFullYear();
    const m = now.getMonth();
    const monthClients = clients.filter(c => {
      const d = parseISO(c.data_vencimento);
      return d.getFullYear() === y && d.getMonth() === m && c.operator_id === profile?.id;
    });
    const paymentsThisMonth = monthClients.filter(c => c.status === "pago").length;
    const breaksThisMonth = monthClients.filter(c => c.status === "quebrado").length;
    const totalReceived = monthClients.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_pago), 0);
    return { paymentsThisMonth, breaksThisMonth, totalReceived };
  };

  const paymentMutation = useMutation({
    mutationFn: ({ client, valor }: { client: Client; valor: number }) =>
      markAsPaid(client, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Pagamento registrado!");
      setPaymentClient(null);
      // Trigger gamification check after data refreshes
      setTimeout(() => {
        const stats = computeMonthStats();
        checkAndGrantAchievements({ ...stats, isGoalReached: false });
      }, 1000);
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const breakMutation = useMutation({
    mutationFn: (client: Client) => markAsBroken(client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Quebra registrada!");
      setTimeout(() => {
        const stats = computeMonthStats();
        checkAndGrantAchievements({ ...stats, isGoalReached: false });
      }, 1000);
    },
    onError: () => toast.error("Erro ao registrar quebra"),
  });

  

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      if (selectedYears.length > 0 && !selectedYears.includes(d.getFullYear().toString())) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(d.getMonth().toString())) return false;
      return true;
    });
  }, [clients, selectedYears, selectedMonths]);

  const yearOptions = useMemo(() => generateYearOptions().map((y) => ({ value: y.toString(), label: y.toString() })), []);
  const monthOptions = useMemo(() => monthNames.map((name, i) => ({ value: i.toString(), label: name })), []);

  const browseDateStr = format(browseDate, "yyyy-MM-dd");
  const browseClients = useMemo(() => {
    return clients.filter((c) => c.data_vencimento === browseDateStr);
  }, [clients, browseDateStr]);

  const navigateDate = (dir: number) => {
    setBrowseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const pagos = filteredClients.filter((c) => c.status === "pago");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");

  const totalProjetado = filteredClients.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = quebrados.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalEmAberto = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Bem-vindo, {profile?.full_name || "Operador"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions.canViewRelatorios && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary text-primary hover:bg-primary/10"
              onClick={() => navigate("/relatorios")}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary text-primary hover:bg-primary/10"
            onClick={() => navigate("/analytics")}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>
          <MultiSelect
            options={yearOptions}
            selected={selectedYears}
            onChange={setSelectedYears}
            allLabel="Todos Anos"
            className="w-[120px]"
          />
          <MultiSelect
            options={monthOptions}
            selected={selectedMonths}
            onChange={setSelectedMonths}
            allLabel="Todos Meses"
            className="w-[130px]"
          />
        </div>
      </div>

      {/* Main stat: Total Projetado */}
      <div className="rounded-2xl gradient-orange p-6 text-center shadow-lg">
        <p className="text-sm text-primary-foreground/80 font-medium mb-1">Total Projetado no Mês</p>
        <p className="text-4xl font-bold text-primary-foreground tracking-tight">{formatCurrency(totalProjetado)}</p>
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
        <span className="text-xs text-muted-foreground">
          {browseClients.length} registros • {formatCurrency(browseClients.reduce((s, c) => s + Number(c.valor_parcela), 0))}
        </span>
      </div>

      {/* Stat cards row + Mini Ranking */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Total de Quebra" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="Pendentes" value={formatCurrency(totalEmAberto)} icon="receivable" />
        <StatCard title="Acordos do Dia" value={String(acordosDia)} icon="agreement" />
        <StatCard title="Acordos do Mês" value={String(acordosMes)} icon="agreement" />
      </div>

      <MiniRanking />

      {/* Meus Clientes table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-card-foreground">Meus Clientes</h2>
        </div>

        {browseClients.length === 0 ? (
          <div className="p-5 text-center text-muted-foreground text-xs">
            Nenhum vencimento para esta data
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">CPF</TableHead>
                  <TableHead className="text-xs">Credor</TableHead>
                  <TableHead className="text-xs text-center">Parcela</TableHead>
                  <TableHead className="text-xs text-right">Valor da Parcela</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                  <TableHead className="text-xs text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {browseClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs font-medium">
                      <button
                        onClick={() => navigate(`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}`)}
                        className="text-primary hover:underline cursor-pointer text-left"
                      >
                        {client.nome_completo}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{client.cpf}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{client.credor}</TableCell>
                    <TableCell className="text-xs text-center">{client.numero_parcela}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(Number(client.valor_parcela))}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        client.status === "pago" ? "bg-success/10 text-success border-success/30" :
                        client.status === "quebrado" ? "bg-destructive/10 text-destructive border-destructive/30" :
                        "bg-warning/10 text-warning border-warning/30"
                      }`}>
                        {client.status === "pago" ? "Pago" : client.status === "quebrado" ? "Quebrado" : "Pendente"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {client.status === "pendente" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                              onClick={() => setPaymentClient(client)}
                              title="Registrar pagamento"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => breakMutation.mutate(client)}
                              disabled={breakMutation.isPending}
                              title="Registrar quebra"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
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
