import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { Target, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface MetaGaugeCardProps {
  percent: number;
  received: number;
  goal: number;
  monthLabel: string;
  year?: number;
  month?: number; // 1-12
  size?: number;
  duration?: number;
}

const MetaGaugeCard = ({
  percent,
  received,
  goal,
  monthLabel,
  year,
  month,
  size = 220,
  duration = 1.2,
}: MetaGaugeCardProps) => {
  const clampedPct = Math.min(100, Math.max(0, percent));

  // Geometry - thicker stroke for a bolder look
  const strokeWidth = Math.max(16, size * 0.085);
  const radius = size * 0.38;
  const center = size / 2;
  const circumference = Math.PI * radius;
  const innerRadius = radius - strokeWidth / 2;

  // Animation
  const animatedValue = useMotionValue(0);
  const offset = useTransform(animatedValue, [0, 100], [circumference, 0]);
  const progressAngle = useTransform(animatedValue, [0, 100], [-Math.PI, 0]);
  const displayPct = useTransform(animatedValue, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(animatedValue, clampedPct, { duration, ease: "easeOut" });
    return controls.stop;
  }, [clampedPct, animatedValue, duration]);

  // Progress color by performance band
  const progressColorVar =
    clampedPct >= 91
      ? "hsl(var(--success))"
      : clampedPct >= 81
      ? "#3b82f6"
      : clampedPct >= 41
      ? "#f97316"
      : "hsl(var(--destructive))";

  const progressColorEnd =
    clampedPct >= 91
      ? "hsl(var(--success))"
      : clampedPct >= 81
      ? "#60a5fa"
      : clampedPct >= 41
      ? "#fb923c"
      : "hsl(var(--destructive))";

  // Period label
  const ref = year && month ? new Date(year, month - 1, 1) : new Date();
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const firstDay = `01/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;

  const fontSize = Math.max(34, size * 0.18);
  const uniqueId = `meta-${size}`;

  return (
    <div className="flex items-center gap-4 w-full">
      {/* Gauge - left side, larger */}
      <div className="relative shrink-0" style={{ width: size, height: size * 0.62 }}>
        <svg
          width={size}
          height={size * 0.62}
          viewBox={`0 0 ${size} ${size * 0.55}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={`baseGradient-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.08" />
            </linearGradient>

            <linearGradient id={`progressGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={progressColorVar} stopOpacity="0.9" />
              <stop offset="100%" stopColor={progressColorEnd} />
            </linearGradient>

            <filter id={`glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id={`dropshadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={progressColorVar} floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Base track */}
          <path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke={`url(#baseGradient-${uniqueId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Animated progress arc */}
          <motion.path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke={`url(#progressGradient-${uniqueId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter={`url(#dropshadow-${uniqueId})`}
          />

          {/* Glowing dot at progress end */}
          <motion.circle
            cx={useTransform(progressAngle, (a) => center + Math.cos(a) * innerRadius)}
            cy={useTransform(progressAngle, (a) => center + Math.sin(a) * innerRadius)}
            r={strokeWidth / 2.2}
            fill={progressColorEnd}
            filter={`url(#glow-${uniqueId})`}
          />
        </svg>

        {/* Animated percentage display */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none"
          style={{ paddingBottom: size * 0.02 }}
        >
          <motion.div
            className="font-bold tracking-tight leading-none"
            style={{ fontSize: `${fontSize}px`, color: progressColorVar }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: duration * 0.6 }}
          >
            <motion.span>{displayPct}</motion.span>
            <span style={{ fontSize: `${fontSize * 0.55}px` }}>%</span>
          </motion.div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">
            {clampedPct >= 100 ? "🏆 META ATINGIDA!" : "do objetivo"}
          </p>
        </div>
      </div>

      {/* Meta / Realizado - right side, compact */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="rounded-lg border border-primary/20 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Target className="w-3 h-3 text-primary" />
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
              Meta
            </p>
          </div>
          <p className="text-sm font-bold text-foreground tabular-nums truncate">
            {formatCurrency(goal)}
          </p>
        </div>

        <div className="rounded-lg border border-success/20 bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TrendingUp className="w-3 h-3 text-success" />
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
              Realizado
            </p>
          </div>
          <p className="text-sm font-bold text-success tabular-nums truncate">
            {formatCurrency(received)}
          </p>
        </div>

        <p className="text-[9px] text-muted-foreground text-center mt-0.5">
          {firstDay} à {lastDayStr}
        </p>
      </div>
    </div>
  );
};

export default MetaGaugeCard;
