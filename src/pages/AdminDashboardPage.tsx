import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Users, TrendingUp, Handshake, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

const COLORS = ["hsl(24 95% 53%)", "hsl(200 80% 50%)", "hsl(142 71% 45%)", "hsl(270 70% 60%)", "hsl(340 80% 55%)"];

const monthLabel = (d: Date) => format(d, "MMM/yy", { locale: ptBR });

function StatBadge({ value, prev }: { value: number; prev: number }) {
  if (prev === 0) return null;
  const pct = ((value - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-green-500" : "text-destructive"}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── types ───────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

interface ClientAgg {
  tenant_id: string;
  count: number;
  total_received: number;
  prev_received: number;
}

interface AgreementAgg {
  tenant_id: string;
  total: number;
  approved: number;
}

interface UserAgg {
  tenant_id: string;
  count: number;
}

// ─── component ───────────────────────────────────────────────────────────────

const AdminDashboardPage = () => {
  const { isSuperAdmin } = useTenant();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, "yyyy-MM"));

  const monthStart = startOfMonth(new Date(`${selectedMonth}-01`));
  const monthEnd = endOfMonth(monthStart);
  const prevStart = startOfMonth(subMonths(monthStart, 1));
  const prevEnd = endOfMonth(subMonths(monthStart, 1));

  const last6Months = Array.from({ length: 6 }, (_, i) => subMonths(monthStart, 5 - i));

  // Month options (last 12)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
  });

  // ── queries ──────────────────────────────────────────────────────────────
  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ["sa-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, status, created_at")
        .order("name");
      if (error) throw error;
      return data as TenantRow[];
    },
    enabled: isSuperAdmin,
  });

  // Clients this month
  const { data: clientsThisMonth = [] } = useQuery({
    queryKey: ["sa-clients-month", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("tenant_id, status, valor_pago")
        .gte("updated_at", monthStart.toISOString())
        .lte("updated_at", monthEnd.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Clients prev month
  const { data: clientsPrevMonth = [] } = useQuery({
    queryKey: ["sa-clients-prev", format(prevStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("tenant_id, status, valor_pago")
        .gte("updated_at", prevStart.toISOString())
        .lte("updated_at", prevEnd.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // All clients (for total count per tenant)
  const { data: allClients = [] } = useQuery({
    queryKey: ["sa-clients-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("tenant_id");
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Agreements this month
  const { data: agreementsMonth = [] } = useQuery({
    queryKey: ["sa-agreements-month", selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("tenant_id, status")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString());
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // Active users per tenant
  const { data: tenantUsers = [] } = useQuery({
    queryKey: ["sa-tenant-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, user_id");
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  // 6-month trend per tenant (received)
  const { data: trendData = [] } = useQuery({
    queryKey: ["sa-trend-6m"],
    queryFn: async () => {
      const results = await Promise.all(
        last6Months.map(async (d) => {
          const s = startOfMonth(d).toISOString();
          const e = endOfMonth(d).toISOString();
          const { data } = await supabase
            .from("clients")
            .select("tenant_id, valor_pago, status")
            .gte("updated_at", s)
            .lte("updated_at", e)
            .eq("status", "pago");
          return { month: d, rows: data || [] };
        })
      );
      return results;
    },
    enabled: isSuperAdmin,
  });

  // ── aggregations ─────────────────────────────────────────────────────────

  const clientAggMap = useMemo<Record<string, ClientAgg>>(() => {
    const map: Record<string, ClientAgg> = {};
    // all-time count
    for (const c of allClients) {
      const tid = c.tenant_id;
      if (!map[tid]) map[tid] = { tenant_id: tid, count: 0, total_received: 0, prev_received: 0 };
      map[tid].count++;
    }
    // this month received
    for (const c of clientsThisMonth) {
      const tid = c.tenant_id;
      if (!map[tid]) map[tid] = { tenant_id: tid, count: 0, total_received: 0, prev_received: 0 };
      if (c.status === "pago") map[tid].total_received += Number(c.valor_pago);
    }
    // prev month received
    for (const c of clientsPrevMonth) {
      const tid = c.tenant_id;
      if (!map[tid]) map[tid] = { tenant_id: tid, count: 0, total_received: 0, prev_received: 0 };
      if (c.status === "pago") map[tid].prev_received += Number(c.valor_pago);
    }
    return map;
  }, [allClients, clientsThisMonth, clientsPrevMonth]);

  const agreementAggMap = useMemo<Record<string, AgreementAgg>>(() => {
    const map: Record<string, AgreementAgg> = {};
    for (const a of agreementsMonth) {
      const tid = a.tenant_id;
      if (!map[tid]) map[tid] = { tenant_id: tid, total: 0, approved: 0 };
      map[tid].total++;
      if (a.status === "approved") map[tid].approved++;
    }
    return map;
  }, [agreementsMonth]);

  const userAggMap = useMemo<Record<string, UserAgg>>(() => {
    const map: Record<string, UserAgg> = {};
    for (const u of tenantUsers) {
      const tid = u.tenant_id;
      if (!map[tid]) map[tid] = { tenant_id: tid, count: 0 };
      map[tid].count++;
    }
    return map;
  }, [tenantUsers]);

  // Per-tenant rows for table
  const tenantRows = useMemo(() => {
    return tenants.map((t) => {
      const c = clientAggMap[t.id] || { count: 0, total_received: 0, prev_received: 0 };
      const a = agreementAggMap[t.id] || { total: 0, approved: 0 };
      const u = userAggMap[t.id] || { count: 0 };
      const agreementRate = a.total > 0 ? Math.round((a.approved / a.total) * 100) : 0;
      return { ...t, ...c, ...a, ...u, agreementRate };
    });
  }, [tenants, clientAggMap, agreementAggMap, userAggMap]);

  // Global KPI totals
  const totals = useMemo(() => ({
    clients: tenantRows.reduce((s, r) => s + r.count, 0),
    received: tenantRows.reduce((s, r) => s + r.total_received, 0),
    prevReceived: tenantRows.reduce((s, r) => s + r.prev_received, 0),
    agreements: tenantRows.reduce((s, r) => s + r.total, 0),
    users: tenantRows.reduce((s, r) => s + (r as any).count, 0),
    activeTenants: tenants.filter((t) => t.status === "ativo").length,
  }), [tenantRows, tenants]);

  // Chart: clients per tenant
  const clientsChartData = useMemo(() =>
    tenantRows
      .filter((r) => r.count > 0)
      .map((r) => ({ name: r.name.length > 12 ? r.name.slice(0, 12) + "…" : r.name, clientes: r.count }))
      .sort((a, b) => b.clientes - a.clientes)
      .slice(0, 10),
    [tenantRows]);

  // Chart: received per tenant
  const receivedChartData = useMemo(() =>
    tenantRows
      .filter((r) => r.total_received > 0)
      .map((r) => ({ name: r.name.length > 12 ? r.name.slice(0, 12) + "…" : r.name, recebido: r.total_received }))
      .sort((a, b) => b.recebido - a.recebido)
      .slice(0, 10),
    [tenantRows]);

  // Chart: 6-month MoM trend (sum all tenants)
  const trendChartData = useMemo(() =>
    trendData.map(({ month, rows }) => ({
      mes: monthLabel(month),
      recebido: rows.reduce((s, r) => s + Number(r.valor_pago), 0),
    })),
    [trendData]);

  // Chart: agreement rate pie (top 5 tenants)
  const agreementPieData = useMemo(() =>
    tenantRows
      .filter((r) => r.total > 0)
      .sort((a, b) => b.approved - a.approved)
      .slice(0, 5)
      .map((r) => ({ name: r.name, value: r.approved, total: r.total })),
    [tenantRows]);

  // ── guard ────────────────────────────────────────────────────────────────

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Acesso restrito a Super Administradores.
      </div>
    );
  }

  const isLoading = loadingTenants;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Dashboard Executivo
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão consolidada de todos os tenants</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Empresas Ativas</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totals.activeTenants}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Clientes</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totals.clients.toLocaleString("pt-BR")}</p>
              </div>
              <div className="p-2 bg-secondary rounded-lg">
                <Users className="w-4 h-4 text-secondary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Recuperado no Mês</p>
                <p className="text-xl font-bold text-foreground mt-1">{formatCurrency(totals.received)}</p>
                <StatBadge value={totals.received} prev={totals.prevReceived} />
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Acordos no Mês</p>
                <p className="text-2xl font-bold text-foreground mt-1">{totals.agreements}</p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Handshake className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Usuários Totais</p>
                <p className="text-2xl font-bold text-foreground mt-1">{tenantUsers.length}</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clients per tenant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground">Clientes por Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
            ) : clientsChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clientsChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--card-foreground))" }}
                  />
                  <Bar dataKey="clientes" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recovered per tenant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground">Valor Recuperado por Empresa (mês)</CardTitle>
          </CardHeader>
          <CardContent>
            {receivedChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados no mês selecionado</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={receivedChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--card-foreground))" }}
                    formatter={(v: number) => [formatCurrency(v), "Recuperado"]}
                  />
                  <Bar dataKey="recebido" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MoM trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground">Crescimento Mês a Mês (todos os tenants)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--card-foreground))" }}
                  formatter={(v: number) => [formatCurrency(v), "Total Recuperado"]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="recebido" stroke={COLORS[0]} strokeWidth={2} dot={{ fill: COLORS[0], r: 3 }} name="Total Recuperado" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Agreement rate pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-card-foreground">Acordos Aprovados (top 5)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {agreementPieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem acordos no período</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={agreementPieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="name" label={false}>
                      {agreementPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v, _n, props) => [`${v} / ${props.payload.total}`, props.payload.name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1 w-full">
                  {agreementPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground truncate max-w-[90px]">{d.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{d.value}/{d.total}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenant breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-card-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Desempenho por Empresa — {format(monthStart, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground uppercase border-b border-border">
                  <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-right font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Clientes</th>
                  <th className="px-4 py-2.5 text-right font-medium">Usuários</th>
                  <th className="px-4 py-2.5 text-right font-medium">Recuperado</th>
                  <th className="px-4 py-2.5 text-right font-medium">vs Mês Ant.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Acordos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Taxa Aprv.</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">Carregando empresas...</td>
                  </tr>
                ) : tenantRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhuma empresa encontrada</td>
                  </tr>
                ) : (
                  tenantRows.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-sm text-card-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.slug}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={r.status === "ativo" ? "default" : "secondary"} className="text-xs">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right font-medium">{r.count.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2.5 text-sm text-right">{userAggMap[r.id]?.count ?? 0}</td>
                      <td className="px-4 py-2.5 text-sm text-right font-semibold text-success">{formatCurrency(r.total_received)}</td>
                      <td className="px-4 py-2.5 text-sm text-right">
                        <StatBadge value={r.total_received} prev={r.prev_received} />
                      </td>
                      <td className="px-4 py-2.5 text-sm text-right">{r.total}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-semibold ${r.agreementRate >= 50 ? "text-primary" : r.agreementRate > 0 ? "text-warning" : "text-muted-foreground"}`}>
                          {r.agreementRate > 0 ? `${r.agreementRate}%` : "—"}
                        </span>
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
  );
};

export default AdminDashboardPage;
