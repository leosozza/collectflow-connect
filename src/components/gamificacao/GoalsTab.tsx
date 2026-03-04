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

/* ───── Gauge SVG Component ───── */
const GaugeChart = ({ percent, received, goal, monthLabel }: { percent: number; received: number; goal: number; monthLabel: string }) => {
  const clampedPct = Math.min(100, Math.max(0, percent));
  const cx = 200, cy = 190, r = 150;
  const startAngle = 135; // degrees
  const endAngle = 405;   // 135 + 270
  const totalArc = 270;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // arc path
  const arcPath = (from: number, to: number) => {
    const a1 = toRad(from), a2 = toRad(to);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const largeArc = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // needle angle
  const needleAngle = startAngle + (clampedPct / 100) * totalArc;
  const needleLen = r - 20;
  const nx = cx + needleLen * Math.cos(toRad(needleAngle));
  const ny = cy + needleLen * Math.sin(toRad(needleAngle));

  // gradient stops: red(0%) → yellow(50%) → green(100%)
  const seg1End = startAngle + totalArc * 0.4;
  const seg2End = startAngle + totalArc * 0.7;

  // date range
  const now = new Date();
  const firstDay = `01/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 400 260" className="w-full max-w-lg">
        {/* Background arc */}
        <path d={arcPath(startAngle, endAngle)} fill="none" stroke="hsl(var(--muted))" strokeWidth="28" strokeLinecap="round" />

        {/* Red segment 0-40% */}
        <path d={arcPath(startAngle, seg1End)} fill="none" stroke="#ef4444" strokeWidth="28" strokeLinecap="round" />

        {/* Yellow segment 40-70% */}
        <path d={arcPath(seg1End, seg2End)} fill="none" stroke="#eab308" strokeWidth="28" strokeLinecap="round" />

        {/* Green segment 70-100% */}
        <path d={arcPath(seg2End, endAngle)} fill="none" stroke="#22c55e" strokeWidth="28" strokeLinecap="round" />

        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="8" fill="hsl(var(--foreground))" />
        <circle cx={cx} cy={cy} r="4" fill="hsl(var(--background))" />

        {/* Percentage text */}
        <text x={cx} y={cy - 30} textAnchor="middle" className="fill-foreground text-4xl font-bold" fontSize="42" fontWeight="700">
          {clampedPct}%
        </text>

        {/* Labels */}
        <text x={cx} y={cy + 5} textAnchor="middle" className="fill-muted-foreground" fontSize="13">
          {clampedPct >= 100 ? "🏆 META ATINGIDA!" : "do objetivo"}
        </text>
      </svg>

      {/* Info cards below gauge */}
      <div className="grid grid-cols-2 gap-6 w-full max-w-lg mt-2">
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Meta Recebimento</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(goal)}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Realizado</p>
          <p className="text-xl font-bold text-success">{formatCurrency(received)}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Período: {firstDay} à {lastDayStr} • {monthLabel}
      </p>
    </div>
  );
};

/* ───── GoalsTab ───── */
const GoalsTab = () => {
  const { profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = now.toLocaleString("pt-BR", { month: "long", year: "numeric" });

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

  // Operator view — Gauge
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
      <Card className="border-border max-w-xl mx-auto">
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2 justify-center">
            <Target className="w-5 h-5 text-primary" />
            Minha Meta do Mês
            {progress >= 100 && <Badge className="text-xs h-5 px-2 ml-1">🏆 Atingida!</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          <GaugeChart percent={progress} received={received} goal={goalAmount} monthLabel={monthLabel} />
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
