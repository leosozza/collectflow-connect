import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { exportToExcel } from "@/lib/exportUtils";
import { exportToPDF } from "@/lib/exportUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  DollarSign, TrendingUp, Users, BarChart3, AlertTriangle, Activity, UserX,
  HeartPulse, Ticket, Clock, LogIn, Zap, Building2, Info, FileSpreadsheet, FileText,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ───── helpers ───── */
const now = new Date();
const months6 = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i));
const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-popover-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" && p.value > 999 ? formatCurrency(p.value) : p.value}</p>
      ))}
    </div>
  );
};

/* Tooltip-enabled KPI card */
const KPICard = ({ icon: Icon, label, tooltip, value, sub, color }: {
  icon: React.ElementType; label: string; tooltip: string; value: string | number; sub?: string; color?: string;
}) => (
  <Card>
    <CardContent className="pt-4 pb-3 px-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color || "text-primary"}`} />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                {label} <Info className="w-3 h-3 opacity-50" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </CardContent>
  </Card>
);

/* Export buttons */
const ExportButtons = ({ onExcel, pdfId, pdfName }: { onExcel: () => void; pdfId: string; pdfName: string }) => (
  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={onExcel}>
      <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
    </Button>
    <Button variant="outline" size="sm" onClick={() => exportToPDF(pdfId, pdfName)}>
      <FileText className="w-4 h-4 mr-1" /> PDF
    </Button>
  </div>
);

/* Health score badge */
const HealthBadge = ({ score }: { score: number }) => {
  const status = score >= 80 ? "Saudável" : score >= 50 ? "Atenção" : "Em Risco";
  const cls = score >= 80 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : score >= 50 ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-destructive/10 text-destructive border-destructive/30";
  return <Badge variant="outline" className={cls}>{status}</Badge>;
};

/* ───── Main ───── */
const AdminDashboardPage = () => {
  const { isSuperAdmin } = useTenant();
  const [tab, setTab] = useState("receita");

  /* ── Data queries ── */
  const { data: tenants = [] } = useQuery({
    queryKey: ["sa-tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name, slug, status, plan_id, created_at, deleted_at").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["sa-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*");
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: tenantUsers = [] } = useQuery({
    queryKey: ["sa-tenant-users"],
    queryFn: async () => {
      const { data } = await supabase.from("tenant_users").select("tenant_id, user_id");
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["sa-activity-logs"],
    queryFn: async () => {
      const since = subDays(now, 30).toISOString();
      const { data } = await supabase.from("user_activity_logs" as any).select("user_id, tenant_id, activity_type, page_path, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
      return (data || []) as any[];
    },
    enabled: isSuperAdmin,
  });

  const { data: supportTickets = [] } = useQuery({
    queryKey: ["sa-tickets"],
    queryFn: async () => {
      const { data } = await supabase.from("support_tickets").select("id, status, priority, created_at, updated_at").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["sa-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_records").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  /* ── Derived data ── */
  const planMap = useMemo(() => Object.fromEntries(plans.map((p: any) => [p.id, p])), [plans]);
  const activeTenants = useMemo(() => tenants.filter((t: any) => t.status === "active"), [tenants]);
  const deletedTenants = useMemo(() => tenants.filter((t: any) => t.status === "deleted"), [tenants]);

  // ─ Receita ─
  const mrr = useMemo(() => activeTenants.reduce((s: number, t: any) => s + (planMap[t.plan_id]?.price_monthly || 0), 0), [activeTenants, planMap]);
  const arr = mrr * 12;
  const ticketMedio = activeTenants.length > 0 ? mrr / activeTenants.length : 0;

  const monthStart = startOfMonth(now).toISOString();
  const receitaMes = useMemo(() => payments.filter((p: any) => p.status === "completed" && p.created_at >= monthStart).reduce((s: number, p: any) => s + Number(p.amount), 0), [payments, monthStart]);

  const receitaPorPlano = useMemo(() => {
    const m: Record<string, { name: string; value: number; count: number }> = {};
    activeTenants.forEach((t: any) => {
      const plan = planMap[t.plan_id];
      if (!plan) return;
      if (!m[plan.id]) m[plan.id] = { name: plan.name, value: 0, count: 0 };
      m[plan.id].value += plan.price_monthly || 0;
      m[plan.id].count++;
    });
    return Object.values(m);
  }, [activeTenants, planMap]);

  const receitaMensal = useMemo(() => months6.map(m => {
    const start = startOfMonth(m);
    const end = endOfMonth(m);
    const total = payments.filter((p: any) => p.status === "completed" && new Date(p.created_at) >= start && new Date(p.created_at) <= end).reduce((s: number, p: any) => s + Number(p.amount), 0);
    return { month: format(m, "MMM/yy", { locale: ptBR }), receita: Math.round(total) };
  }), [payments]);

  // ─ Crescimento ─
  const newThisMonth = useMemo(() => tenants.filter((t: any) => t.status !== "deleted" && new Date(t.created_at) >= startOfMonth(now)).length, [tenants]);
  const newLast7 = useMemo(() => tenants.filter((t: any) => t.status !== "deleted" && new Date(t.created_at) >= subDays(now, 7)).length, [tenants]);
  const prevMonthActive = useMemo(() => {
    const pm = startOfMonth(subMonths(now, 1));
    return tenants.filter((t: any) => new Date(t.created_at) < pm && (t.status === "active" || (t.status === "deleted" && t.deleted_at && new Date(t.deleted_at) >= pm))).length;
  }, [tenants]);
  const growthRate = prevMonthActive > 0 ? (((activeTenants.length - prevMonthActive) / prevMonthActive) * 100).toFixed(1) : "—";
  const inactiveTenants = tenants.filter((t: any) => t.status === "suspended").length;

  const growthData = useMemo(() => months6.map(m => {
    const start = startOfMonth(m);
    const end = endOfMonth(m);
    return {
      month: format(m, "MMM/yy", { locale: ptBR }),
      novos: tenants.filter((t: any) => t.status !== "deleted" && new Date(t.created_at) >= start && new Date(t.created_at) <= end).length,
      acumulado: tenants.filter((t: any) => t.status !== "deleted" && new Date(t.created_at) <= end).length,
    };
  }), [tenants]);

  // ─ Uso ─
  const uniqueUsersToday = useMemo(() => {
    const today = format(now, "yyyy-MM-dd");
    return new Set(activityLogs.filter((l: any) => l.created_at?.startsWith(today)).map((l: any) => l.user_id)).size;
  }, [activityLogs]);
  const uniqueUsersWeek = useMemo(() => {
    const since = subDays(now, 7).toISOString();
    return new Set(activityLogs.filter((l: any) => l.created_at >= since).map((l: any) => l.user_id)).size;
  }, [activityLogs]);
  const uniqueUsersMonth = useMemo(() => new Set(activityLogs.map((l: any) => l.user_id)).size, [activityLogs]);

  const topPages = useMemo(() => {
    const m: Record<string, number> = {};
    activityLogs.filter((l: any) => l.activity_type === "page_view" && l.page_path).forEach((l: any) => {
      const p = l.page_path.replace(/^\//, "").split("/")[0] || "dashboard";
      m[p] = (m[p] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, views]) => ({ name, views }));
  }, [activityLogs]);

  const activityByDay = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => subDays(now, 13 - i));
    return days.map(d => {
      const key = format(d, "yyyy-MM-dd");
      const count = new Set(activityLogs.filter((l: any) => l.created_at?.startsWith(key)).map((l: any) => l.user_id)).size;
      return { day: format(d, "dd/MM"), usuarios: count };
    });
  }, [activityLogs]);

  // ─ Cancelamento ─
  const cancelledThisMonth = useMemo(() => deletedTenants.filter((t: any) => t.deleted_at && new Date(t.deleted_at) >= startOfMonth(now)).length, [deletedTenants]);
  const churnRate = prevMonthActive > 0 ? ((cancelledThisMonth / prevMonthActive) * 100).toFixed(1) : "0.0";
  const churnAnual = prevMonthActive > 0 ? (((cancelledThisMonth * 12) / prevMonthActive) * 100).toFixed(1) : "0.0";
  const receitaPerdida = useMemo(() => deletedTenants.filter((t: any) => t.deleted_at && new Date(t.deleted_at) >= startOfMonth(now)).reduce((s: number, t: any) => s + (planMap[t.plan_id]?.price_monthly || 0), 0), [deletedTenants, planMap]);

  const churnByMonth = useMemo(() => months6.map(m => {
    const start = startOfMonth(m);
    const end = endOfMonth(m);
    return {
      month: format(m, "MMM/yy", { locale: ptBR }),
      cancelamentos: deletedTenants.filter((t: any) => t.deleted_at && new Date(t.deleted_at) >= start && new Date(t.deleted_at) <= end).length,
    };
  }), [deletedTenants]);

  // ─ Operacional ─
  const ticketsOpen = supportTickets.filter((t: any) => t.status === "open" || t.status === "pending").length;
  const ticketsResolved = supportTickets.filter((t: any) => t.status === "resolved" || t.status === "closed").length;

  // ─ Saúde ─
  const userLastLogin = useMemo(() => {
    const m: Record<string, string> = {};
    activityLogs.forEach((l: any) => {
      if (!m[l.tenant_id] || l.created_at > m[l.tenant_id]) m[l.tenant_id] = l.created_at;
    });
    return m;
  }, [activityLogs]);

  const healthData = useMemo(() => {
    let healthy = 0, moderate = 0, risk = 0;
    const noLogin7: string[] = [];
    const noLogin30: string[] = [];
    activeTenants.forEach((t: any) => {
      const lastLogin = userLastLogin[t.id];
      if (!lastLogin) { risk++; noLogin30.push(t.name); noLogin7.push(t.name); return; }
      const days = differenceInDays(now, new Date(lastLogin));
      if (days > 30) { risk++; noLogin30.push(t.name); noLogin7.push(t.name); }
      else if (days > 7) { moderate++; noLogin7.push(t.name); }
      else { healthy++; }
    });
    return { healthy, moderate, risk, noLogin7: noLogin7.length, noLogin30: noLogin30.length };
  }, [activeTenants, userLastLogin]);

  const healthPie = [
    { name: "Saudável", value: healthData.healthy },
    { name: "Moderado", value: healthData.moderate },
    { name: "Risco Alto", value: healthData.risk },
  ];

  // ─ Customer Health (detailed per tenant) ─
  const customerHealthRows = useMemo(() => {
    return activeTenants.map((t: any) => {
      const plan = planMap[t.plan_id];
      const lastLogin = userLastLogin[t.id];
      const daysSinceLogin = lastLogin ? differenceInDays(now, new Date(lastLogin)) : 999;

      // Recency score (40%): 0 days = 40, 30+ days = 0
      const recencyScore = Math.max(0, 40 - (daysSinceLogin * 40 / 30));

      // Activity score (30%): proportion of active days in 30-day window
      const tenantLogs = activityLogs.filter((l: any) => l.tenant_id === t.id);
      const activeDays = new Set(tenantLogs.map((l: any) => l.created_at?.substring(0, 10))).size;
      const activityScore = Math.min(30, (activeDays / 30) * 30);

      // User ratio score (30%): active users / total users
      const totalUsers = tenantUsers.filter((u: any) => u.tenant_id === t.id).length;
      const activeUsers = new Set(tenantLogs.map((l: any) => l.user_id)).size;
      const userRatioScore = totalUsers > 0 ? Math.min(30, (activeUsers / totalUsers) * 30) : 0;

      const score = Math.round(recencyScore + activityScore + userRatioScore);

      return {
        id: t.id,
        name: t.name,
        plan: plan?.name || "—",
        score,
        status: score >= 80 ? "Saudável" : score >= 50 ? "Atenção" : "Em Risco",
        lastLogin: lastLogin ? new Date(lastLogin).toLocaleDateString("pt-BR") : "Nunca",
        daysSinceLogin,
        totalUsers,
        activeUsers,
        activeDays,
      };
    }).sort((a, b) => a.score - b.score);
  }, [activeTenants, planMap, userLastLogin, activityLogs, tenantUsers]);

  // ─ Radar ─
  const alerts = useMemo(() => {
    const list: { icon: React.ElementType; text: string; severity: string }[] = [];
    if (parseFloat(churnRate) > 5) list.push({ icon: AlertTriangle, text: `Churn mensal em ${churnRate}%`, severity: "destructive" });
    if (healthData.noLogin30 > 0) list.push({ icon: UserX, text: `${healthData.noLogin30} clientes sem login há +30 dias`, severity: "destructive" });
    if (healthData.risk > activeTenants.length * 0.3 && activeTenants.length > 0) list.push({ icon: HeartPulse, text: `${healthData.risk} clientes em risco alto de churn`, severity: "destructive" });
    if (uniqueUsersMonth < tenantUsers.length * 0.3 && tenantUsers.length > 5) list.push({ icon: Activity, text: `Apenas ${uniqueUsersMonth} de ${tenantUsers.length} usuários ativos no mês`, severity: "warning" });
    if (ticketsOpen > 10) list.push({ icon: Ticket, text: `${ticketsOpen} tickets de suporte abertos`, severity: "warning" });
    if (cancelledThisMonth > 0) list.push({ icon: UserX, text: `${cancelledThisMonth} cancelamento(s) neste mês`, severity: "warning" });
    return list;
  }, [churnRate, healthData, uniqueUsersMonth, tenantUsers, ticketsOpen, cancelledThisMonth, activeTenants]);

  /* ── Export handlers ── */
  const exportReceita = () => exportToExcel([
    { Métrica: "MRR", Valor: mrr },
    { Métrica: "ARR", Valor: arr },
    { Métrica: "Receita do Mês", Valor: receitaMes },
    { Métrica: "Ticket Médio", Valor: ticketMedio },
    ...receitaPorPlano.map(p => ({ Métrica: `Plano: ${p.name}`, Valor: p.value, Clientes: p.count })),
    ...receitaMensal.map(r => ({ Métrica: `Receita ${r.month}`, Valor: r.receita })),
  ], "Receita", "dashboard_receita");

  const exportCrescimento = () => exportToExcel([
    { Métrica: "Total Clientes", Valor: tenants.filter((t: any) => t.status !== "deleted").length },
    { Métrica: "Novos no Mês", Valor: newThisMonth },
    { Métrica: "Novos (7 dias)", Valor: newLast7 },
    { Métrica: "Crescimento %", Valor: growthRate },
    { Métrica: "Ativos", Valor: activeTenants.length },
    { Métrica: "Inativos", Valor: inactiveTenants },
    { Métrica: "Excluídos", Valor: deletedTenants.length },
    ...growthData.map(g => ({ Métrica: `Novos ${g.month}`, Valor: g.novos, Acumulado: g.acumulado })),
  ], "Crescimento", "dashboard_crescimento");

  const exportUso = () => exportToExcel([
    { Métrica: "DAU", Valor: uniqueUsersToday },
    { Métrica: "WAU", Valor: uniqueUsersWeek },
    { Métrica: "MAU", Valor: uniqueUsersMonth },
    { Métrica: "Total Usuários", Valor: tenantUsers.length },
    ...topPages.map(p => ({ Métrica: `Página: ${p.name}`, Valor: p.views })),
  ], "Uso", "dashboard_uso");

  const exportCancelamento = () => exportToExcel([
    { Métrica: "Cancelados (mês)", Valor: cancelledThisMonth },
    { Métrica: "Churn Mensal %", Valor: churnRate },
    { Métrica: "Churn Anual %", Valor: churnAnual },
    { Métrica: "Receita Perdida", Valor: receitaPerdida },
    ...deletedTenants.map((t: any) => ({
      Empresa: t.name,
      Plano: planMap[t.plan_id]?.name || "—",
      "Data Cancelamento": t.deleted_at ? new Date(t.deleted_at).toLocaleDateString("pt-BR") : "—",
    })),
  ], "Cancelamento", "dashboard_cancelamento");

  const exportOperacional = () => exportToExcel([
    { Métrica: "Tickets Abertos", Valor: ticketsOpen },
    { Métrica: "Tickets Resolvidos", Valor: ticketsResolved },
    { Métrica: "Total Tickets", Valor: supportTickets.length },
    { Métrica: "Prioridade Alta", Valor: supportTickets.filter((t: any) => t.priority === "high").length },
    { Métrica: "Prioridade Média", Valor: supportTickets.filter((t: any) => t.priority === "medium").length },
    { Métrica: "Prioridade Baixa", Valor: supportTickets.filter((t: any) => t.priority === "low").length },
  ], "Operacional", "dashboard_operacional");

  const exportSaude = () => exportToExcel([
    { Métrica: "Saudáveis", Valor: healthData.healthy },
    { Métrica: "Moderados", Valor: healthData.moderate },
    { Métrica: "Risco Alto", Valor: healthData.risk },
    { Métrica: "Sem Login 30d", Valor: healthData.noLogin30 },
  ], "Saúde", "dashboard_saude");

  const exportCustomerHealth = () => exportToExcel(
    customerHealthRows.map(r => ({
      Cliente: r.name,
      Plano: r.plan,
      "Health Score": r.score,
      Status: r.status,
      "Último Login": r.lastLogin,
      "Dias Inativo": r.daysSinceLogin >= 999 ? "Nunca" : r.daysSinceLogin,
      "Usuários Ativos": r.activeUsers,
      "Usuários Totais": r.totalUsers,
    })),
    "Customer Health", "dashboard_customer_health"
  );

  if (!isSuperAdmin) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-muted-foreground">Acesso restrito a Super Admins.</p></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Dashboard Executivo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão consolidada de {activeTenants.length} empresas ativas</p>
      </div>

      {/* ── Radar ── */}
      {alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Radar da Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-background/80 rounded-md border border-border px-3 py-2">
                  <a.icon className={`w-4 h-4 shrink-0 ${a.severity === "destructive" ? "text-destructive" : "text-amber-500"}`} />
                  <span className="text-foreground">{a.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="receita" className="text-xs">Receita</TabsTrigger>
          <TabsTrigger value="crescimento" className="text-xs">Crescimento</TabsTrigger>
          <TabsTrigger value="uso" className="text-xs">Uso</TabsTrigger>
          <TabsTrigger value="cancelamento" className="text-xs">Cancelamento</TabsTrigger>
          <TabsTrigger value="operacional" className="text-xs">Operacional</TabsTrigger>
          <TabsTrigger value="saude" className="text-xs">Saúde</TabsTrigger>
          <TabsTrigger value="customer-health" className="text-xs"><HeartPulse className="w-3.5 h-3.5 mr-1" />Customer Health</TabsTrigger>
        </TabsList>

        {/* ═══════ RECEITA ═══════ */}
        <TabsContent value="receita" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <ExportButtons onExcel={exportReceita} pdfId="tab-receita" pdfName="Dashboard_Receita" />
          </div>
          <div id="tab-receita" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={DollarSign} label="MRR" tooltip="Receita recorrente mensal da plataforma. Soma de todas as assinaturas ativas no mês atual." value={formatCurrency(mrr)} />
              <KPICard icon={TrendingUp} label="ARR" tooltip="Receita recorrente anual estimada. Calculada multiplicando o MRR por 12." value={formatCurrency(arr)} />
              <KPICard icon={DollarSign} label="Receita do Mês" tooltip="Total de receita efetivamente recebida (pagamentos confirmados) no mês atual." value={formatCurrency(receitaMes)} color="text-emerald-500" />
              <KPICard icon={Users} label="Ticket Médio" tooltip="Valor médio pago por cliente ativo na plataforma. MRR ÷ total de clientes pagantes." value={formatCurrency(ticketMedio)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução da Receita Mensal</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={receitaMensal}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <RTooltip content={<ChartTooltip />} />
                      <Bar dataKey="receita" name="Receita (R$)" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Receita por Plano</CardTitle></CardHeader>
                <CardContent>
                  {receitaPorPlano.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={receitaPorPlano} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${formatCurrency(value)}`} labelLine={false}>
                          {receitaPorPlano.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════ CRESCIMENTO ═══════ */}
        <TabsContent value="crescimento" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <ExportButtons onExcel={exportCrescimento} pdfId="tab-crescimento" pdfName="Dashboard_Crescimento" />
          </div>
          <div id="tab-crescimento" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={Building2} label="Total Clientes" tooltip="Número total de empresas cadastradas na plataforma (excluindo deletadas)." value={tenants.filter((t: any) => t.status !== "deleted").length} />
              <KPICard icon={TrendingUp} label="Novos no Mês" tooltip="Clientes que se cadastraram no mês corrente." value={newThisMonth} />
              <KPICard icon={Zap} label="Novos (7 dias)" tooltip="Clientes cadastrados nos últimos 7 dias." value={newLast7} />
              <KPICard icon={TrendingUp} label="Crescimento" tooltip="Taxa de crescimento da base de clientes em relação ao mês anterior." value={`${growthRate}%`} />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <KPICard icon={Users} label="Ativos" tooltip="Clientes com assinatura ativa." value={activeTenants.length} color="text-emerald-500" />
              <KPICard icon={UserX} label="Inativos" tooltip="Clientes com assinatura suspensa." value={inactiveTenants} color="text-amber-500" />
              <KPICard icon={UserX} label="Excluídos" tooltip="Total de clientes que foram excluídos." value={deletedTenants.length} color="text-destructive" />
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Novos Clientes por Mês</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={growthData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <RTooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="novos" name="Novos" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ USO ═══════ */}
        <TabsContent value="uso" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <ExportButtons onExcel={exportUso} pdfId="tab-uso" pdfName="Dashboard_Uso" />
          </div>
          <div id="tab-uso" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={LogIn} label="DAU" tooltip="Usuários ativos hoje. Número de usuários únicos que acessaram a plataforma hoje." value={uniqueUsersToday} />
              <KPICard icon={Activity} label="WAU" tooltip="Usuários ativos na semana. Número de usuários únicos nos últimos 7 dias." value={uniqueUsersWeek} />
              <KPICard icon={Users} label="MAU" tooltip="Usuários ativos mensais que acessaram a plataforma pelo menos uma vez nos últimos 30 dias." value={uniqueUsersMonth} />
              <KPICard icon={Users} label="Total Usuários" tooltip="Total de usuários registrados na plataforma." value={tenantUsers.length} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Atividade de Usuários (14 dias)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={activityByDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RTooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="usuarios" name="Usuários" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Funcionalidades Mais Usadas</CardTitle></CardHeader>
                <CardContent>
                  {topPages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados de atividade</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={topPages} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={55} />
                        <RTooltip content={<ChartTooltip />} />
                        <Bar dataKey="views" name="Acessos" fill="hsl(var(--chart-2))" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════ CANCELAMENTO ═══════ */}
        <TabsContent value="cancelamento" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <ExportButtons onExcel={exportCancelamento} pdfId="tab-cancelamento" pdfName="Dashboard_Cancelamento" />
          </div>
          <div id="tab-cancelamento" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={UserX} label="Cancelados (mês)" tooltip="Número de clientes que cancelaram neste mês." value={cancelledThisMonth} color="text-destructive" />
              <KPICard icon={TrendingUp} label="Churn Mensal" tooltip="Percentual de clientes que cancelaram no período dividido pelos clientes ativos no início do período." value={`${churnRate}%`} color="text-destructive" />
              <KPICard icon={TrendingUp} label="Churn Anual" tooltip="Estimativa anualizada do churn. Churn mensal × 12." value={`${churnAnual}%`} color="text-destructive" />
              <KPICard icon={DollarSign} label="Receita Perdida" tooltip="Receita mensal perdida com os cancelamentos do mês." value={formatCurrency(receitaPerdida)} color="text-destructive" />
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cancelamentos por Mês</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={churnByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip content={<ChartTooltip />} />
                    <Bar dataKey="cancelamentos" name="Cancelamentos" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            {deletedTenants.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de Cancelamentos</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                        <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                        <th className="px-4 py-2.5 text-left font-medium">Plano</th>
                        <th className="px-4 py-2.5 text-left font-medium">Data</th>
                      </tr></thead>
                      <tbody>
                        {deletedTenants.slice(0, 10).map((t: any) => (
                          <tr key={t.id} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{t.name}</td>
                            <td className="px-4 py-2 text-muted-foreground">{planMap[t.plan_id]?.name || "—"}</td>
                            <td className="px-4 py-2 text-muted-foreground">{t.deleted_at ? new Date(t.deleted_at).toLocaleDateString("pt-BR") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════ OPERACIONAL ═══════ */}
        <TabsContent value="operacional" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <ExportButtons onExcel={exportOperacional} pdfId="tab-operacional" pdfName="Dashboard_Operacional" />
          </div>
          <div id="tab-operacional" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={Ticket} label="Tickets Abertos" tooltip="Quantidade de tickets de suporte abertos ou pendentes no momento." value={ticketsOpen} color="text-amber-500" />
              <KPICard icon={Ticket} label="Tickets Resolvidos" tooltip="Quantidade de tickets de suporte resolvidos ou fechados." value={ticketsResolved} color="text-emerald-500" />
              <KPICard icon={Clock} label="Total Tickets" tooltip="Total de tickets registrados na plataforma." value={supportTickets.length} />
              <KPICard icon={Users} label="Usuários Totais" tooltip="Total de usuários cadastrados em todos os tenants." value={tenantUsers.length} />
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Volume de Tickets por Prioridade</CardTitle></CardHeader>
              <CardContent>
                {supportTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhum ticket registrado</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {["high", "medium", "low"].map(p => {
                      const count = supportTickets.filter((t: any) => t.priority === p).length;
                      const labels: Record<string, string> = { high: "Alta", medium: "Média", low: "Baixa" };
                      const colors: Record<string, string> = { high: "text-destructive", medium: "text-amber-500", low: "text-muted-foreground" };
                      return (
                        <div key={p} className="bg-muted/30 rounded-lg p-4 text-center">
                          <p className={`text-2xl font-bold ${colors[p]}`}>{count}</p>
                          <p className="text-xs text-muted-foreground mt-1">{labels[p]}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ SAÚDE ═══════ */}
        <TabsContent value="saude" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <ExportButtons onExcel={exportSaude} pdfId="tab-saude" pdfName="Dashboard_Saude" />
          </div>
          <div id="tab-saude" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={HeartPulse} label="Saudáveis" tooltip="Clientes com login nos últimos 7 dias. Engajamento alto." value={healthData.healthy} color="text-emerald-500" />
              <KPICard icon={Activity} label="Moderados" tooltip="Clientes com login entre 7 e 30 dias atrás. Engajamento moderado." value={healthData.moderate} color="text-amber-500" />
              <KPICard icon={AlertTriangle} label="Risco Alto" tooltip="Clientes sem login há mais de 30 dias. Alto risco de churn." value={healthData.risk} color="text-destructive" />
              <KPICard icon={UserX} label="Sem Login 30d" tooltip="Total de clientes sem nenhum login nos últimos 30 dias." value={healthData.noLogin30} color="text-destructive" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição de Saúde</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={healthPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                        <Cell fill="hsl(var(--chart-2))" />
                        <Cell fill="hsl(var(--chart-4))" />
                        <Cell fill="hsl(var(--destructive))" />
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Atividade Diária (14 dias)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={activityByDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RTooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="usuarios" name="Usuários Ativos" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════ CUSTOMER HEALTH ═══════ */}
        <TabsContent value="customer-health" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <ExportButtons onExcel={exportCustomerHealth} pdfId="tab-customer-health" pdfName="Dashboard_Customer_Health" />
          </div>
          <div id="tab-customer-health" className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard icon={HeartPulse} label="Saudáveis" tooltip="Clientes com Health Score ≥ 80. Alta atividade e engajamento." value={customerHealthRows.filter(r => r.score >= 80).length} color="text-emerald-500" />
              <KPICard icon={Activity} label="Atenção" tooltip="Clientes com Health Score entre 50-79. Engajamento moderado." value={customerHealthRows.filter(r => r.score >= 50 && r.score < 80).length} color="text-amber-500" />
              <KPICard icon={AlertTriangle} label="Em Risco" tooltip="Clientes com Health Score < 50. Alto risco de cancelamento." value={customerHealthRows.filter(r => r.score < 50).length} color="text-destructive" />
              <KPICard icon={Users} label="Score Médio" tooltip="Média do Health Score de todos os clientes ativos." value={customerHealthRows.length > 0 ? Math.round(customerHealthRows.reduce((s, r) => s + r.score, 0) / customerHealthRows.length) : 0} />
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Health Score por Cliente</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                        <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                        <th className="px-4 py-2.5 text-left font-medium">Plano</th>
                        <th className="px-4 py-2.5 text-left font-medium min-w-[160px]">Health Score</th>
                        <th className="px-4 py-2.5 text-left font-medium">Status</th>
                        <th className="px-4 py-2.5 text-left font-medium">Último Login</th>
                        <th className="px-4 py-2.5 text-left font-medium">Inatividade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerHealthRows.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum cliente ativo</td></tr>
                      ) : (
                        customerHealthRows.map(r => (
                          <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium">{r.name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{r.plan}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={r.score}
                                  className="h-2 flex-1"
                                  style={{
                                    // @ts-ignore
                                    "--progress-color": r.score >= 80 ? "hsl(var(--chart-2))" : r.score >= 50 ? "hsl(38, 92%, 50%)" : "hsl(var(--destructive))",
                                  } as React.CSSProperties}
                                />
                                <span className="text-xs font-semibold w-8 text-right">{r.score}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5"><HealthBadge score={r.score} /></td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.lastLogin}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">
                              {r.daysSinceLogin >= 999 ? "Sem atividade" : r.daysSinceLogin === 0 ? "Hoje" : `${r.daysSinceLogin} dias`}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboardPage;
