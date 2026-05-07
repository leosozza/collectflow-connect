import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyGoal, fetchGoals, fetchMyGoalHistory } from "@/services/goalService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { Trophy } from "lucide-react";
import MetaGaugeCard from "@/components/dashboard/MetaGaugeCard";

const monthLabelOf = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });

const GoalsTab = () => {
  const { profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = monthLabelOf(year, month);

  const { data: myGoal } = useQuery({
    queryKey: ["my-goal", year, month],
    queryFn: () => fetchMyGoal(year, month),
    enabled: !isTenantAdmin,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-goal-history", profile?.id],
    queryFn: () => fetchMyGoalHistory(6),
    enabled: !isTenantAdmin && !!profile?.id,
  });

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
        .eq("tenant_id", tenant!.id)
        .eq("year", year)
        .eq("month", month);
      return data || [];
    },
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { data: myPoints } = useQuery({
    queryKey: ["my-points-goal", profile?.id, year, month, tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_points")
        .select("total_received")
        .eq("tenant_id", tenant!.id)
        .eq("operator_id", profile!.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      return data;
    },
    enabled: !isTenantAdmin && !!profile?.id && !!tenant?.id,
  });

  if (!isTenantAdmin) {
    const goalAmount = myGoal?.target_amount || 0;
    const received = Number(myPoints?.total_received || 0);
    const progress = goalAmount > 0 ? Math.min(100, Math.round((received / goalAmount) * 100)) : 0;

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {goalAmount > 0 ? (
          <Card className="border-border overflow-hidden">
            <CardHeader className="pb-0 pt-6">
              <CardTitle className="text-lg flex items-center gap-2 justify-center">
                <Trophy className="w-5 h-5 text-primary" />
                Minha Meta do Mês
                {progress >= 100 && (
                  <Badge className="text-xs h-5 px-2 ml-1 bg-success/10 text-success border-success/20">
                    🏆 Atingida!
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-8">
              <MetaGaugeCard percent={progress} received={received} goal={goalAmount} monthLabel={monthLabel} year={year} month={month} />
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma meta definida para este mês.
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Meses Anteriores</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Recebido</TableHead>
                  <TableHead className="w-40">Progresso</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const pct = h.target_amount > 0 ? Math.min(100, Math.round((h.total_received / h.target_amount) * 100)) : 0;
                  const reached = h.target_amount > 0 && h.total_received >= h.target_amount;
                  return (
                    <TableRow key={`${h.year}-${h.month}`}>
                      <TableCell className="font-medium capitalize">{monthLabelOf(h.year, h.month)}</TableCell>
                      <TableCell>{formatCurrency(h.target_amount)}</TableCell>
                      <TableCell>{formatCurrency(h.total_received)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {h.target_amount === 0 ? (
                          <Badge variant="outline" className="text-xs">Sem meta</Badge>
                        ) : reached ? (
                          <Badge className="text-xs bg-success/10 text-success border-success/20">Atingida</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Não atingida</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  const pointsMap = new Map(points.map((p: any) => [p.operator_id, Number(p.total_received || 0)]));
  const goalMap = new Map(allGoals.map((g) => [g.operator_id, g.target_amount]));
  const operatorsWithGoals = operators.filter((op: any) => goalMap.has(op.id));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Metas do Mês — {monthLabel}</h3>
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
