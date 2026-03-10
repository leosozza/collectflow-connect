import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Building2, Users, Activity } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";

const now = new Date();
const months = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i));

const AdminRelatoriosPage = () => {
  const { isSuperAdmin } = useTenant();

  const { data: tenants = [] } = useQuery({
    queryKey: ["admin-rel-tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name, status, created_at").neq("status", "deleted");
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const growthData = useMemo(() => {
    return months.map(m => {
      const end = endOfMonth(m);
      const count = tenants.filter((t: any) => new Date(t.created_at) <= end).length;
      return {
        month: format(m, "MMM/yy", { locale: ptBR }),
        inquilinos: count,
      };
    });
  }, [tenants]);

  const activeTenants = tenants.filter((t: any) => t.status === "active").length;
  const trialTenants = tenants.filter((t: any) => t.status === "trial").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Relatórios e Análises
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Visão consolidada de crescimento e saúde do sistema</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Inquilinos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{tenants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Ativos</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{activeTenants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Em Trial</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{trialTenants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Saúde Geral</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">Estável</p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Crescimento de Inquilinos (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={growthData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="inquilinos" name="Inquilinos" stroke="hsl(var(--primary))" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRelatoriosPage;
