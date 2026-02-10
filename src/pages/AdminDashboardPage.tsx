import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { calculateTieredCommission, CommissionGrade, CommissionTier } from "@/lib/commission";
import StatCard from "@/components/StatCard";
import PaymentDialog from "@/components/clients/PaymentDialog";
import { markAsPaid, markAsBroken, Client } from "@/services/clientService";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  commission_rate: number;
  commission_grade_id: string | null;
}

interface ClientRow {
  id: string;
  operator_id: string | null;
  valor_parcela: number;
  valor_pago: number;
  quebra: number;
  status: string;
  data_vencimento: string;
  nome_completo: string;
  cpf: string;
  credor: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  created_at: string;
  updated_at: string;
}

const generateYearOptions = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 3; i++) years.push(now.getFullYear() - i);
  return years;
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const AdminDashboardPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString());
  const [selectedOperator, setSelectedOperator] = useState<string>("todos");
  const [browseDate, setBrowseDate] = useState(new Date());
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);

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
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "operador");
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

  const paymentMutation = useMutation({
    mutationFn: ({ client, valor }: { client: Client; valor: number }) => markAsPaid(client, valor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Pagamento registrado!");
      setPaymentClient(null);
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const breakMutation = useMutation({
    mutationFn: (client: Client) => markAsBroken(client),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast.success("Quebra registrada!");
    },
    onError: () => toast.error("Erro ao registrar quebra"),
  });

  const yearOptions = useMemo(generateYearOptions, []);

  // Filter by year/month
  const monthFilteredClients = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    return allClients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [allClients, selectedYear, selectedMonth]);

  // Filter by operator
  const filteredClients =
    selectedOperator === "todos"
      ? monthFilteredClients
      : monthFilteredClients.filter((c) => c.operator_id === selectedOperator);

  const pendentes = filteredClients.filter((c) => c.status === "pendente");
  const pagos = filteredClients.filter((c) => c.status === "pago");
  const quebrados = filteredClients.filter((c) => c.status === "quebrado");

  const totalProjetado = filteredClients.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalRecebido = pagos.reduce((s, c) => s + Number(c.valor_pago), 0);
  const totalQuebra = quebrados.reduce((s, c) => s + Number(c.valor_parcela), 0);
  const totalEmAberto = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0);

  const totalPagosQuebrados = pagos.length + quebrados.length;
  const pctRecebidos = totalPagosQuebrados > 0 ? ((pagos.length / totalPagosQuebrados) * 100).toFixed(1) : "0";
  const pctQuebras = totalPagosQuebrados > 0 ? ((quebrados.length / totalPagosQuebrados) * 100).toFixed(1) : "0";

  // Commission for selected operator
  const selectedOp = operators.find((op) => op.id === selectedOperator);
  const getOperatorCommission = (op: Profile, received: number) => {
    const grade = grades.find((g) => g.id === op.commission_grade_id);
    if (grade) return calculateTieredCommission(received, grade.tiers as CommissionTier[]);
    return { rate: op.commission_rate, commission: received * (op.commission_rate / 100) };
  };

  const selectedCommission = selectedOp
    ? getOperatorCommission(selectedOp, totalRecebido)
    : { rate: 0, commission: 0 };

  // Browse date for vencimentos
  const browseDateStr = format(browseDate, "yyyy-MM-dd");
  const browseClients = useMemo(() => {
    const base = selectedOperator === "todos"
      ? allClients
      : allClients.filter((c) => c.operator_id === selectedOperator);
    return base.filter((c) => c.data_vencimento === browseDateStr);
  }, [allClients, selectedOperator, browseDateStr]);

  const navigateDate = (dir: number) => {
    setBrowseDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + dir);
      return d;
    });
  };

  // Per-operator stats
  const operatorStats = operators.map((op) => {
    const opClients = monthFilteredClients.filter((c) => c.operator_id === op.id);
    const opPagos = opClients.filter((c) => c.status === "pago");
    const opRecebido = opPagos.reduce((s, c) => s + Number(c.valor_pago), 0);
    const opQuebra = opClients.filter((c) => c.status === "quebrado").reduce((s, c) => s + Number(c.valor_parcela), 0);
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
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground text-sm">
            {selectedOperator === "todos"
              ? "Visão consolidada de todos operadores"
              : `Visualizando: ${selectedOp?.full_name || "Operador"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {operators.map((op) => (
                <SelectItem key={op.id} value={op.id}>
                  {op.full_name || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[120px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((name, i) => (
                <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main stat: Total Projetado */}
      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground font-medium mb-1">Total Projetado no Mês</p>
        <p className="text-4xl font-bold text-foreground tracking-tight">{formatCurrency(totalProjetado)}</p>
      </div>

      {/* Row 2: Recebido, Quebra, Em Aberto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon="received" />
        <StatCard title="Total de Quebra" value={formatCurrency(totalQuebra)} icon="broken" />
        <StatCard title="Total em Aberto" value={formatCurrency(totalEmAberto)} icon="receivable" />
      </div>

      {/* Row 3: % Recebidos, % Quebras, Comissão */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="% de Recebidos" value={`${pctRecebidos}%`} icon="received" />
        <StatCard title="% de Quebras" value={`${pctQuebras}%`} icon="percent" />
        {selectedOperator !== "todos" ? (
          <StatCard title={`Comissão (${selectedCommission.rate}%)`} value={formatCurrency(selectedCommission.commission)} icon="commission" />
        ) : (
          <StatCard title="Comissão" value="Selecione operador" icon="commission" />
        )}
      </div>

      {/* Vencimentos - date navigator */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-card-foreground">Vencimentos</h2>
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
                    <TableCell className="text-xs font-medium text-card-foreground">{client.nome_completo}</TableCell>
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
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                              onClick={() => setPaymentClient(client as unknown as Client)}
                              title="Registrar pagamento"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => breakMutation.mutate(client as unknown as Client)}
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
                    onClick={() => setSelectedOperator(selectedOperator === op.id ? "todos" : op.id)}
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

      <PaymentDialog
        client={paymentClient}
        onClose={() => setPaymentClient(null)}
        onConfirm={(valor) => {
          if (paymentClient) paymentMutation.mutate({ client: paymentClient, valor });
        }}
        submitting={paymentMutation.isPending}
      />
    </div>
  );
};

export default AdminDashboardPage;
