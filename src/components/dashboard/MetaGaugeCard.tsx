import { motion } from "framer-motion";
import { Target, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface MetaGaugeCardProps {
  percent: number;
  received: number;
  goal: number;
  monthLabel: string;
  year?: number;
  month?: number; // 1-12
}

const MetaGaugeCard = ({ percent, received, goal, monthLabel, year, month }: MetaGaugeCardProps) => {
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

  const seg1End = startAngle + totalArc * 0.4;
  const seg2End = startAngle + totalArc * 0.7;

  const ref = year && month ? new Date(year, month - 1, 1) : new Date();
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const firstDay = `01/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;

  const getProgressColor = () => {
    if (clampedPct >= 70) return "#22c55e";
    if (clampedPct >= 40) return "#eab308";
    return "#ef4444";
  };
  const progressColor = getProgressColor();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-sm mx-auto">
        <svg viewBox="0 -15 260 210" className="w-full">
          <defs>
            <filter id="meta-needle-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.25" />
            </filter>
          </defs>

          <path d={arcPath(startAngle, endAngle)} fill="none" stroke="hsl(var(--muted))" strokeWidth="20" strokeLinecap="round" opacity="0.3" />
          <path d={arcPath(startAngle, seg1End)} fill="none" stroke="#ef4444" strokeWidth="20" strokeLinecap="round" opacity="0.8" />
          <path d={arcPath(seg1End, seg2End)} fill="none" stroke="#eab308" strokeWidth="20" strokeLinecap="round" opacity="0.8" />
          <path d={arcPath(seg2End, endAngle)} fill="none" stroke="#22c55e" strokeWidth="20" strokeLinecap="round" opacity="0.8" />

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

          <motion.g
            initial={{ rotate: startAngle, originX: cx, originY: cy }}
            animate={{ rotate: needleAngle }}
            transition={{ type: "spring", stiffness: 40, damping: 12, delay: 0.3 }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <line x1={cx} y1={cy} x2={cx + needleLen} y2={cy} stroke="hsl(var(--foreground))" strokeWidth="2.5" strokeLinecap="round" filter="url(#meta-needle-shadow)" />
          </motion.g>

          <circle cx={cx} cy={cy} r="8" fill="hsl(var(--foreground))" />
          <circle cx={cx} cy={cy} r="5" fill="hsl(var(--background))" />
          <circle cx={cx} cy={cy} r="2.5" fill={progressColor} />

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

          <text x={cx} y={cy - 14} textAnchor="middle" className="fill-muted-foreground" fontSize="9" fontWeight="500">
            {clampedPct >= 100 ? "🏆 META ATINGIDA!" : "do objetivo mensal"}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Meta Recebimento</p>
          </div>
          <p className="text-lg font-bold text-foreground">{formatCurrency(goal)}</p>
        </div>
        <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Realizado</p>
          </div>
          <p className="text-lg font-bold text-success">{formatCurrency(received)}</p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Período: {firstDay} à {lastDayStr} • {monthLabel}
      </p>
    </div>
  );
};

export default MetaGaugeCard;
