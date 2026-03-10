import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Users, CreditCard, BarChart3 } from "lucide-react";

const AdminFinanceiroPage = () => {
  const { isSuperAdmin } = useTenant();

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

  const planMap = Object.fromEntries(plans.map((p: any) => [p.id, p]));
  const activeTenants = tenants.filter((t: any) => t.status === "active");
  const mrr = activeTenants.reduce((sum: number, t: any) => {
    const plan = planMap[t.plan_id];
    return sum + (plan?.price_monthly || 0);
  }, 0);
  const arr = mrr * 12;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-primary" />
          Gestão Financeira
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Métricas financeiras e status dos inquilinos</p>
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
    </div>
  );
};

export default AdminFinanceiroPage;
