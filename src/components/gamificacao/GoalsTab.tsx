import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyGoal, fetchGoals } from "@/services/goalService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Target } from "lucide-react";

const GoalsTab = () => {
  const { profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Operator view: own goal
  const { data: myGoal } = useQuery({
    queryKey: ["my-goal", year, month],
    queryFn: () => fetchMyGoal(year, month),
    enabled: !isTenantAdmin,
  });

  // Admin view: all goals + operators + points
  const { data: allGoals = [] } = useQuery({
    queryKey: ["goals", year, month, null],
    queryFn: () => fetchGoals(year, month, null),
    enabled: isTenantAdmin,
  });

  const { data: operators = [] } = useQuery({
    queryKey: ["tenant-operators", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      return data || [];
    },
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { data: points = [] } = useQuery({
    queryKey: ["operator-points-all", year, month, tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_points")
        .select("operator_id, total_received")
        .eq("year", year)
        .eq("month", month);
      return data || [];
    },
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { data: myPoints } = useQuery({
    queryKey: ["my-points-goal", profile?.id, year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_points")
        .select("total_received")
        .eq("operator_id", profile!.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      return data;
    },
    enabled: !isTenantAdmin && !!profile?.id,
  });

  // Operator view
  if (!isTenantAdmin) {
    const goalAmount = myGoal?.target_amount || 0;
    const received = Number(myPoints?.total_received || 0);
    const progress = goalAmount > 0 ? Math.min(100, Math.round((received / goalAmount) * 100)) : 0;

    if (!goalAmount) {
      return (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma meta definida para este mês.
        </div>
      );
    }

    return (
      <Card className="border-border max-w-md mx-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Minha Meta do Mês
            {progress >= 100 && <Badge className="text-[10px] h-5 px-1.5 ml-1">🏆 Atingida!</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">{formatCurrency(received)} recebido</span>
            <span className="font-semibold text-foreground">{progress}% de {formatCurrency(goalAmount)}</span>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>
    );
  }

  // Admin view
  const pointsMap = new Map(points.map((p: any) => [p.operator_id, Number(p.total_received || 0)]));
  const goalMap = new Map(allGoals.map((g) => [g.operator_id, g.target_amount]));

  const operatorsWithGoals = operators.filter((op: any) => goalMap.has(op.id));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Metas do Mês — {new Date(year, month - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}</h3>
      {operatorsWithGoals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma meta definida para este mês.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operador</TableHead>
              <TableHead>Meta</TableHead>
              <TableHead>Recebido</TableHead>
              <TableHead className="w-32">Progresso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operatorsWithGoals.map((op: any) => {
              const target = goalMap.get(op.id) || 0;
              const received = pointsMap.get(op.id) || 0;
              const pct = target > 0 ? Math.min(100, Math.round((received / target) * 100)) : 0;
              return (
                <TableRow key={op.id}>
                  <TableCell className="font-medium">{op.full_name || "Sem nome"}</TableCell>
                  <TableCell>{formatCurrency(target)}</TableCell>
                  <TableCell>{formatCurrency(received)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default GoalsTab;
