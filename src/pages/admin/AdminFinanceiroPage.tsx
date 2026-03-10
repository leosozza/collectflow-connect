import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Users, CreditCard, BarChart3, Receipt, AlertTriangle, UserCheck } from "lucide-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-200" },
  completed: { label: "Confirmado", className: "bg-green-500/10 text-green-600 border-green-200" },
  overdue: { label: "Vencido", className: "bg-destructive/10 text-destructive border-destructive/20" },
  refunded: { label: "Estornado", className: "bg-muted text-muted-foreground" },
};

const billingTypeLabels: Record<string, string> = {
  CREDIT_CARD: "Cartão",
  PIX: "PIX",
  BOLETO: "Boleto",
};

const AdminFinanceiroPage = () => {
  const { isSuperAdmin } = useTenant();
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [searchTenant, setSearchTenant] = useState("");

  const { data: tenants = [] } = useQuery({
    queryKey: ["admin-fin-tenants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, status, plan_id, created_at")
        .neq("status", "deleted")
        .order("name");
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-fin-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").eq("is_active", true);
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["admin-all-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: asaasCustomers = [] } = useQuery({
    queryKey: ["admin-asaas-customers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("asaas_customers" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: isSuperAdmin,
  });

  const planMap = Object.fromEntries(plans.map((p: any) => [p.id, p]));
  const tenantMap = Object.fromEntries(tenants.map((t: any) => [t.id, t]));
  const activeTenants = tenants.filter((t: any) => t.status === "active");
  const mrr = activeTenants.reduce((sum: number, t: any) => {
    const plan = planMap[t.plan_id];
    return sum + (plan?.price_monthly || 0);
  }, 0);
  const arr = mrr * 12;

  // Payment KPIs
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthPayments = allPayments.filter((p: any) => p.created_at >= monthStart);
  const totalReceived = monthPayments
    .filter((p: any) => p.status === "completed")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalPending = monthPayments
    .filter((p: any) => p.status === "pending")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalOverdue = allPayments
    .filter((p: any) => p.status === "overdue")
    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  // Filter payments
  const filteredPayments = allPayments.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (methodFilter !== "all" && (p.billing_type || p.payment_method) !== methodFilter) return false;
    if (searchTenant) {
      const tenant = tenantMap[p.tenant_id];
      if (!tenant?.name?.toLowerCase().includes(searchTenant.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-primary" />
          Gestão Financeira
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Métricas financeiras, cobranças e status dos inquilinos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">MRR</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(mrr)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">ARR</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(arr)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Clientes Ativos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{activeTenants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Churn</span>
            </div>
            <p className="text-2xl font-bold text-foreground">0%</p>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Asaas Payment KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-green-500/20">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Recebido (mês)</span>
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pendente (mês)</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Inadimplência</span>
            </div>
            <p className="text-xl font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Financial Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Faturamento por Inquilino
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-left font-medium">Plano</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor Mensal</th>
                  <th className="px-4 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t: any) => {
                  const plan = planMap[t.plan_id];
                  return (
                    <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{t.name}</td>
                      <td className="px-4 py-2.5">{plan?.name || "—"}</td>
                      <td className="px-4 py-2.5 text-right">{plan ? formatCurrency(plan.price_monthly) : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={t.status === "active" ? "default" : "secondary"}>
                          {t.status === "active" ? "Ativo" : t.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {tenants.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhum inquilino encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cobranças Asaas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Cobranças Asaas
          </CardTitle>
          <CardDescription>Todas as cobranças processadas pelo gateway</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Buscar por empresa..."
              className="max-w-[200px]"
              value={searchTenant}
              onChange={(e) => setSearchTenant(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Confirmado</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
                <SelectItem value="refunded">Estornado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="BOLETO">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Tenant</th>
                  <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                  <th className="px-4 py-2.5 text-center font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-center font-medium">Método</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p: any) => {
                  const tenant = tenantMap[p.tenant_id];
                  const st = statusConfig[p.status] || statusConfig.pending;
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{tenant?.name || p.tenant_id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(Number(p.amount))}</td>
                      <td className="px-4 py-2.5 text-center capitalize">
                        {p.payment_type === "token_purchase" ? "Tokens" : p.payment_type === "subscription" ? "Mensalidade" : p.payment_type}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {billingTypeLabels[p.billing_type] || p.payment_method || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge variant="outline" className={st.className}>{st.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
                {filteredPayments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhuma cobrança encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Clientes Asaas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Clientes Asaas
          </CardTitle>
          <CardDescription>Tenants vinculados ao gateway de pagamento</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Tenant</th>
                  <th className="px-4 py-2.5 text-left font-medium">ID Asaas</th>
                  <th className="px-4 py-2.5 text-left font-medium">CPF/CNPJ</th>
                  <th className="px-4 py-2.5 text-left font-medium">E-mail</th>
                  <th className="px-4 py-2.5 text-left font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {asaasCustomers.map((c: any) => {
                  const tenant = tenantMap[c.tenant_id];
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{tenant?.name || c.tenant_id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{c.asaas_customer_id}</td>
                      <td className="px-4 py-2.5">{c.cpf_cnpj}</td>
                      <td className="px-4 py-2.5">{c.email || "—"}</td>
                      <td className="px-4 py-2.5">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  );
                })}
                {asaasCustomers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">Nenhum cliente Asaas vinculado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinanceiroPage;
