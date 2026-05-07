import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { fetchGoals, fetchMyGoals } from "@/services/goalService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { Trophy, Users } from "lucide-react";
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

  const { data: myGoals = [] } = useQuery({
    queryKey: ["my-goals", year, month, tenant?.id],
    queryFn: () => fetchMyGoals(year, month, tenant?.id),
    enabled: !isTenantAdmin && !!tenant?.id,
  });

  const { data: allGoals = [] } = useQuery({
    queryKey: ["goals-all", year, month, tenant?.id],
    queryFn: () => fetchGoals(year, month, undefined, tenant?.id),
    enabled: isTenantAdmin && !!tenant?.id,
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

  const { data: teams = [] } = useQuery({
    queryKey: ["tenant-teams", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipes")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("status", "ativa")
        .order("nome");
      return data || [];
    },
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["tenant-team-members", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipe_membros")
        .select("equipe_id, profile_id")
        .eq("tenant_id", tenant!.id);
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
    const goalAmount = myGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
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
      <Card className="border-border max-w-3xl mx-auto overflow-hidden">
        <CardHeader className="pb-0 pt-6">
          <CardTitle className="text-lg flex items-center gap-2 justify-center">
            <Trophy className="w-5 h-5 text-primary" />
            Minha Meta do Mês
            {progress >= 100 && <Badge className="text-xs h-5 px-2 ml-1 bg-success/10 text-success border-success/20">🏆 Atingida!</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-8">
          <MetaGaugeCard percent={progress} received={received} goal={goalAmount} monthLabel={monthLabel} year={year} month={month} />
        </CardContent>
      </Card>
    );
  }

  const pointsMap = new Map(points.map((p: any) => [p.operator_id, Number(p.total_received || 0)]));
  const operatorGoalMap = new Map();
  allGoals.forEach(g => {
    const current = operatorGoalMap.get(g.operator_id) || 0;
    operatorGoalMap.set(g.operator_id, current + Number(g.target_amount || 0));
  });

  const operatorsWithGoals = operators.filter((op: any) => operatorGoalMap.has(op.id));

  // Team aggregation
  const teamStats = teams.map(team => {
    const members = Array.from(new Set(teamMembers.filter(m => m.equipe_id === team.id).map(m => m.profile_id)));
    const teamGoal = members.reduce((sum, pid) => sum + (operatorGoalMap.get(pid) || 0), 0);
    const teamReceived = members.reduce((sum, pid) => sum + (pointsMap.get(pid) || 0), 0);
    const pct = teamGoal > 0 ? Math.min(100, Math.round((teamReceived / teamGoal) * 100)) : 0;
    return { ...team, teamGoal, teamReceived, pct };
  }).filter(t => t.teamGoal > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Metas do Mês — {monthLabel}</h3>
      </div>

      <Tabs defaultValue="operadores" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
          <TabsTrigger value="operadores" className="gap-2">
            <Users className="w-4 h-4" /> Operadores
          </TabsTrigger>
          <TabsTrigger value="equipes" className="gap-2">
            <Users className="w-4 h-4" /> Equipes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operadores">
          {operatorsWithGoals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
              Nenhuma meta definida para operadores este mês.
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Operador</TableHead>
                    <TableHead>Meta</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead className="w-32">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operatorsWithGoals.map((op: any) => {
                    const target = operatorGoalMap.get(op.id) || 0;
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipes">
          {teamStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
              Nenhuma equipe com metas definidas (vincule operadores com metas às equipes).
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Equipe</TableHead>
                    <TableHead>Meta (Soma Operadores)</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead className="w-32">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamStats.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell>{formatCurrency(t.teamGoal)}</TableCell>
                      <TableCell>{formatCurrency(t.teamReceived)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={t.pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-10 text-right">{t.pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GoalsTab;
