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
import { Target, TrendingUp, Trophy } from "lucide-react";
import { motion } from "framer-motion";

/* ───── Gauge SVG Component ───── */
const GaugeChart = ({ percent, received, goal, monthLabel }: { percent: number; received: number; goal: number; monthLabel: string }) => {
  const clampedPct = Math.min(100, Math.max(0, percent));
  const cx = 130, cy = 130, r = 100;
  const startAngle = 135;
  const endAngle = 405;
  const totalArc = 270;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (from: number, to: number) => {
    const a1 = toRad(from), a2 = toRad(to);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const largeArc = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const needleAngle = startAngle + (clampedPct / 100) * totalArc;
  const needleLen = r - 30;
  const nx = cx + needleLen * Math.cos(toRad(needleAngle));
  const ny = cy + needleLen * Math.sin(toRad(needleAngle));

  const seg1End = startAngle + totalArc * 0.4;
  const seg2End = startAngle + totalArc * 0.7;

  const now = new Date();
  const firstDay = `01/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;

  // Dynamic color based on progress
  const getProgressColor = () => {
    if (clampedPct >= 100) return "#22c55e";
    if (clampedPct >= 70) return "#22c55e";
    if (clampedPct >= 40) return "#eab308";
    return "#ef4444";
  };

  const progressColor = getProgressColor();
  const filledAngle = startAngle + (clampedPct / 100) * totalArc;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-sm mx-auto">
        <svg viewBox="0 -15 260 210" className="w-full">
          <defs>
            <filter id="needle-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Background track */}
          <path d={arcPath(startAngle, endAngle)} fill="none" stroke="hsl(var(--muted))" strokeWidth="20" strokeLinecap="round" opacity="0.3" />

          {/* Red segment 0-40% */}
          <path d={arcPath(startAngle, seg1End)} fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="round" opacity="0.8" />

          {/* Yellow segment 40-70% */}
          <path d={arcPath(seg1End, seg2End)} fill="none" stroke="#eab308" strokeWidth="20" strokeLinecap="round" opacity="0.8" />

          {/* Green segment 70-100% */}
          <path d={arcPath(seg2End, endAngle)} fill="none" stroke="#22c55e" strokeWidth="20" strokeLinecap="round" opacity="0.8" />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = startAngle + (tick / 100) * totalArc;
            const innerR = r + 14;
            const outerR = r + 20;
            const ix = cx + innerR * Math.cos(toRad(angle));
            const iy = cy + innerR * Math.sin(toRad(angle));
            const ox = cx + outerR * Math.cos(toRad(angle));
            const oy = cy + outerR * Math.sin(toRad(angle));
            const tx = cx + (outerR + 10) * Math.cos(toRad(angle));
            const ty = cy + (outerR + 10) * Math.sin(toRad(angle));
            return (
              <g key={tick}>
                <line x1={ix} y1={iy} x2={ox} y2={oy} stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="8" className="fill-muted-foreground" fontWeight="500">
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Animated needle */}
          <motion.g
            initial={{ rotate: startAngle, originX: cx, originY: cy }}
            animate={{ rotate: needleAngle }}
            transition={{ type: "spring", stiffness: 40, damping: 12, delay: 0.3 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <line x1={cx} y1={cy} x2={cx + needleLen} y2={cy} stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" filter="url(#needle-shadow)" />
          </motion.g>

          {/* Center hub */}
          <circle cx={cx} cy={cy} r="8" fill="hsl(var(--foreground))" />
          <circle cx={cx} cy={cy} r="5" fill="hsl(var(--background))" />
          <circle cx={cx} cy={cy} r="2.5" fill={progressColor} />

          {/* Percentage text */}
          <motion.text
            x={cx} y={cy - 32}
            textAnchor="middle"
            fontSize="32"
            fontWeight="800"
            fill={progressColor}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            {clampedPct}%
          </motion.text>

          {/* Sub label */}
          <text x={cx} y={cy - 14} textAnchor="middle" className="fill-muted-foreground" fontSize="9" fontWeight="500">
            {clampedPct >= 100 ? "🏆 META ATINGIDA!" : "do objetivo mensal"}
          </text>
        </svg>
      </div>

      {/* Info cards below gauge */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Meta Recebimento</p>
          </div>
          <p className="text-lg font-bold text-foreground">{formatCurrency(goal)}</p>
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Realizado</p>
          </div>
          <p className="text-lg font-bold text-green-500">{formatCurrency(received)}</p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
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

  const { data: myGoal } = useQuery({
    queryKey: ["my-goal", year, month],
    queryFn: () => fetchMyGoal(year, month),
    enabled: !isTenantAdmin,
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
      <Card className="border-border max-w-3xl mx-auto overflow-hidden">
        <CardHeader className="pb-0 pt-6">
          <CardTitle className="text-lg flex items-center gap-2 justify-center">
            <Trophy className="w-5 h-5 text-primary" />
            Minha Meta do Mês
            {progress >= 100 && <Badge className="text-xs h-5 px-2 ml-1 bg-green-500/10 text-green-500 border-green-500/20">🏆 Atingida!</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-8">
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
