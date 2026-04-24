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
  size = 200,
  duration = 1.2,
}: MetaGaugeCardProps) => {
  const clampedPct = Math.min(100, Math.max(0, percent));

  // Geometry
  const strokeWidth = Math.max(12, size * 0.06);
  const radius = size * 0.35;
  const center = size / 2;
  const circumference = Math.PI * radius;
  const innerLineRadius = radius - strokeWidth - 4;
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

  // Period label
  const ref = year && month ? new Date(year, month - 1, 1) : new Date();
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const firstDay = `01/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;

  const fontSize = Math.max(28, size * 0.13);
  const labelFontSize = Math.max(11, size * 0.038);
  const uniqueId = `meta-${size}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative mx-auto" style={{ width: size, height: size * 0.7 }}>
        <svg
          width={size}
          height={size * 0.7}
          viewBox={`0 0 ${size} ${size * 0.7}`}
          className="overflow-visible"
        >
          <defs>
            {/* Base track gradient */}
            <linearGradient id={`baseGradient-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.25" />
              <stop offset="50%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.18" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.12" />
            </linearGradient>

            {/* Progress gradient — performance-based */}
            <linearGradient id={`progressGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={progressColorVar} stopOpacity="0.85" />
              <stop offset="50%" stopColor={progressColorVar} />
              <stop offset="100%" stopColor={progressColorVar} stopOpacity="0.95" />
            </linearGradient>

            {/* Subtle inner-line gradient */}
            <linearGradient id={`textGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.2" />
            </linearGradient>

            {/* Drop shadow */}
            <filter id={`dropshadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="hsl(var(--foreground))" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* Inner thin line */}
          <path
            d={`M ${center - innerLineRadius} ${center} A ${innerLineRadius} ${innerLineRadius} 0 0 1 ${center + innerLineRadius} ${center}`}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="1"
            strokeLinecap="butt"
            opacity="0.4"
          />

          {/* Base track */}
          <path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke={`url(#baseGradient-${uniqueId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            filter={`url(#dropshadow-${uniqueId})`}
          />

          {/* Animated progress arc */}
          <motion.path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke={`url(#progressGradient-${uniqueId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter={`url(#dropshadow-${uniqueId})`}
          />

          {/* Animated extending tick line at progress end */}
          <motion.line
            x1={useTransform(progressAngle, (a) => center + Math.cos(a) * innerRadius)}
            y1={useTransform(progressAngle, (a) => center + Math.sin(a) * innerRadius)}
            x2={useTransform(progressAngle, (a) => center + Math.cos(a) * innerRadius - Math.cos(a) * 30)}
            y2={useTransform(progressAngle, (a) => center + Math.sin(a) * innerRadius - Math.sin(a) * 30)}
            stroke={`url(#textGradient-${uniqueId})`}
            strokeWidth="1"
            strokeLinecap="butt"
          />
        </svg>

        {/* Animated percentage display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ paddingTop: size * 0.12 }}>
          <motion.div
            className="font-bold tracking-tight leading-none"
            style={{ fontSize: `${fontSize}px`, color: progressColorVar }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: duration * 0.6 }}
          >
            <motion.span>{displayPct}</motion.span>%
          </motion.div>
          <p className="text-[10px] text-muted-foreground font-medium mt-1">
            {clampedPct >= 100 ? "🏆 META ATINGIDA!" : "do objetivo mensal"}
          </p>
        </div>

        {/* 0% / 100% labels */}
        <motion.div
          className="absolute text-muted-foreground font-medium"
          style={{
            fontSize: `${labelFontSize}px`,
            left: center - radius - 5,
            top: center + strokeWidth / 2,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: duration * 0.25 }}
        >
          0%
        </motion.div>
        <motion.div
          className="absolute text-muted-foreground font-medium"
          style={{
            fontSize: `${labelFontSize}px`,
            left: center + radius - 20,
            top: center + strokeWidth / 2,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: duration * 0.25 }}
        >
          100%
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Target className="w-3 h-3 text-primary" />
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Meta</p>
          </div>
          <p className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(goal)}</p>
        </div>
        <div className="rounded-lg border border-success/20 bg-success/5 p-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="w-3 h-3 text-success" />
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Realizado</p>
          </div>
          <p className="text-sm font-bold text-success tabular-nums">{formatCurrency(received)}</p>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground text-center">
        {firstDay} à {lastDayStr} • {monthLabel}
      </p>
    </div>
  );
};

export default MetaGaugeCard;
