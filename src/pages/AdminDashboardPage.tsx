import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import {
  Building2, Users, DollarSign, TrendingUp, Handshake, BarChart3,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TenantRow { id: string; name: string; slug: string; status: string; }
interface ClientAgg { tenant_id: string; count: number; }
interface AgreementAgg { tenant_id: string; total: number; closed: number; }
interface UserAgg { tenant_id: string; count: number; }

const now = new Date();
const months = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-popover-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const AdminDashboardPage = () => {
  const { isSuperAdmin } = useTenant();

  const { data: tenants = [] } = useQuery<TenantRow[]>({
    queryKey: ["super-admin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, status")
        .neq("status", "deleted")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Clients count by tenant
  const { data: clientsRaw = [] } = useQuery({
    queryKey: ["exec-clients-by-tenant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("tenant_id, id");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Agreements by tenant
  const { data: agreementsRaw = [] } = useQuery({
    queryKey: ["exec-agreements-by-tenant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("tenant_id, status, proposed_total");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Profiles (users) by tenant
  const { data: profilesRaw = [] } = useQuery({
    queryKey: ["exec-profiles-by-tenant"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_users")
        .select("tenant_id, user_id");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Month-over-month: agreements per tenant per month (last 6 months)
  const { data: agreementsByMonth = [] } = useQuery({
    queryKey: ["exec-agreements-by-month"],
    queryFn: async () => {
      const since = format(startOfMonth(months[0]), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("agreements")
        .select("tenant_id, created_at, proposed_total, status")
        .gte("created_at", since);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const tenantMap = useMemo(() => {
    const m: Record<string, string> = {};
    tenants.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [tenants]);

  // Clients per tenant
  const clientsByTenant = useMemo<ClientAgg[]>(() => {
    const map: Record<string, number> = {};
    clientsRaw.forEach((c: any) => {
      if (c.tenant_id) map[c.tenant_id] = (map[c.tenant_id] || 0) + 1;
    });
    return Object.entries(map)
      .map(([tenant_id, count]) => ({ tenant_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [clientsRaw]);

  // Agreements agg per tenant
  const agreementsByTenant = useMemo<AgreementAgg[]>(() => {
    const map: Record<string, { total: number; closed: number }> = {};
    agreementsRaw.forEach((a: any) => {
      if (!a.tenant_id) return;
      if (!map[a.tenant_id]) map[a.tenant_id] = { total: 0, closed: 0 };
      map[a.tenant_id].total++;
      if (["approved", "pago", "active"].includes(a.status)) map[a.tenant_id].closed++;
    });
    return Object.entries(map)
      .map(([tenant_id, v]) => ({ tenant_id, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [agreementsRaw]);

  // Users per tenant
  const usersByTenant = useMemo<UserAgg[]>(() => {
    const map: Record<string, number> = {};
    profilesRaw.forEach((p: any) => {
      if (p.tenant_id) map[p.tenant_id] = (map[p.tenant_id] || 0) + 1;
    });
    return Object.entries(map)
      .map(([tenant_id, count]) => ({ tenant_id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [profilesRaw]);

  // Recovered value per tenant (approved agreements)
  const recoveredByTenant = useMemo(() => {
    const map: Record<string, number> = {};
    agreementsRaw.forEach((a: any) => {
      if (!a.tenant_id) return;
      if (["approved", "pago", "active"].includes(a.status)) {
        map[a.tenant_id] = (map[a.tenant_id] || 0) + Number(a.proposed_total || 0);
      }
    });
    return Object.entries(map)
      .map(([tenant_id, value]) => ({ tenant_id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [agreementsRaw]);

  // Month-over-month growth (total agreements per month across all tenants)
  const growthData = useMemo(() => {
    return months.map(m => {
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const count = agreementsByMonth.filter((a: any) => {
        const d = new Date(a.created_at);
        return d >= start && d <= end;
      }).length;
      const value = agreementsByMonth
        .filter((a: any) => {
          const d = new Date(a.created_at);
          return d >= start && d <= end && ["approved", "pago", "active"].includes(a.status);
        })
        .reduce((s: number, a: any) => s + Number(a.proposed_total || 0), 0);
      return {
        month: format(m, "MMM/yy", { locale: ptBR }),
        acordos: count,
        recuperado: Math.round(value),
      };
    });
  }, [agreementsByMonth]);

  // Top-level KPIs
  const totalClients = clientsRaw.length;
  const totalRecovered = agreementsRaw
    .filter((a: any) => ["approved", "pago", "active"].includes(a.status))
    .reduce((s: number, a: any) => s + Number(a.proposed_total || 0), 0);
  const totalAgreements = agreementsRaw.length;
  const closedAgreements = agreementsRaw.filter((a: any) =>
    ["approved", "pago", "active"].includes(a.status)
  ).length;
  const conversionRate = totalAgreements > 0
    ? ((closedAgreements / totalAgreements) * 100).toFixed(1)
    : "0.0";
  const totalUsers = profilesRaw.length;

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a Super Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Dashboard Executivo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão consolidada de {tenants.length} empresas ativas
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Clientes</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalClients.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Recuperado</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRecovered)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Handshake className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Taxa de Acordos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground">{closedAgreements}/{totalAgreements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Usuários Ativos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">{tenants.length} empresas</p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Crescimento Mês a Mês (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={growthData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }}
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="acordos" name="Acordos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="recuperado" name="Valor (R$)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Two columns: clients + recovered */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clients by tenant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Clientes por Empresa (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {clientsByTenant.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clientsByTenant.map(c => ({
                  name: (tenantMap[c.tenant_id] || c.tenant_id).slice(0, 14),
                  clientes: c.count,
                }))} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="clientes" name="Clientes" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recovered value by tenant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Valor Recuperado por Empresa (top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {recoveredByTenant.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={recoveredByTenant.map(r => ({
                  name: (tenantMap[r.tenant_id] || r.tenant_id).slice(0, 14),
                  valor: Math.round(r.value),
                }))} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="valor" name="Valor (R$)" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agreements conversion by tenant (table) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Handshake className="w-4 h-4 text-primary" />
            Taxa de Acordos por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {agreementsByTenant.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                    <th className="px-4 py-2.5 text-right font-medium">Negociados</th>
                    <th className="px-4 py-2.5 text-right font-medium">Fechados</th>
                    <th className="px-4 py-2.5 text-right font-medium">Taxa</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agreementsByTenant.map(a => {
                    const rate = a.total > 0 ? ((a.closed / a.total) * 100).toFixed(1) : "0.0";
                    const rateNum = parseFloat(rate);
                    const tenant = tenants.find(t => t.id === a.tenant_id);
                    return (
                      <tr key={a.tenant_id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{tenant?.name || a.tenant_id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5 text-right">{a.total}</td>
                        <td className="px-4 py-2.5 text-right text-primary">{a.closed}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{rate}%</td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant={rateNum >= 60 ? "default" : rateNum >= 30 ? "secondary" : "destructive"} className="text-xs">
                            {rateNum >= 60 ? "Ótimo" : rateNum >= 30 ? "Regular" : "Baixo"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users by tenant */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Usuários por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {usersByTenant.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem dados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                    <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                    <th className="px-4 py-2.5 text-left font-medium">Slug</th>
                    <th className="px-4 py-2.5 text-right font-medium">Usuários</th>
                    <th className="px-4 py-2.5 text-right font-medium">Clientes</th>
                    <th className="px-4 py-2.5 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usersByTenant.map(u => {
                    const tenant = tenants.find(t => t.id === u.tenant_id);
                    const clientCount = clientsRaw.filter((c: any) => c.tenant_id === u.tenant_id).length;
                    return (
                      <tr key={u.tenant_id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{tenant?.name || u.tenant_id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{tenant?.slug || "-"}</td>
                        <td className="px-4 py-2.5 text-right">{u.count}</td>
                        <td className="px-4 py-2.5 text-right">{clientCount.toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant={tenant?.status === "active" ? "default" : "destructive"} className="text-xs">
                            {tenant?.status === "active" ? "Ativa" : "Suspensa"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
