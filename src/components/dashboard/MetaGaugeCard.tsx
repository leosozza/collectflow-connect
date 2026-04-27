import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { Target } from "lucide-react";
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
  duration = 1.6,
}: MetaGaugeCardProps) => {
  const clampedPct = Math.min(100, Math.max(0, percent));

  // Geometry — radial chart proportions
  const strokeWidth = Math.max(12, size * 0.06);
  const radius = size * 0.35;
  const center = size / 2;
  const circumference = Math.PI * radius;
  const innerRadius = radius - strokeWidth / 2;
  const innerLineRadius = radius - strokeWidth - 4;

  // Animation
  const animatedValue = useMotionValue(0);
  const offset = useTransform(animatedValue, [0, 100], [circumference, 0]);
  const progressAngle = useTransform(animatedValue, [0, 100], [-Math.PI, 0]);
  const displayPct = useTransform(animatedValue, (latest) => Math.round(latest));

  useEffect(() => {
    const controls = animate(animatedValue, clampedPct, { duration, ease: "easeOut" });
    return controls.stop;
  }, [clampedPct, animatedValue, duration]);

  // Period label
  const ref = year && month ? new Date(year, month - 1, 1) : new Date();
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const firstDay = `01/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;

  const fontSize = Math.max(28, size * 0.16);
  const labelFontSize = Math.max(10, size * 0.045);
  const uniqueId = `meta-${size}`;

  // Animated extending line endpoints
  const lineX1 = useTransform(progressAngle, (a) => center + Math.cos(a) * innerRadius);
  const lineY1 = useTransform(progressAngle, (a) => center + Math.sin(a) * innerRadius);
  const lineX2 = useTransform(
    progressAngle,
    (a) => center + Math.cos(a) * innerRadius - Math.cos(a) * (size * 0.1)
  );
  const lineY2 = useTransform(
    progressAngle,
    (a) => center + Math.sin(a) * innerRadius - Math.sin(a) * (size * 0.1)
  );

  return (
    <div className="flex items-center gap-4 w-full">
      {/* Radial gauge */}
      <div
        className="relative shrink-0"
        style={{ width: size, height: size * 0.7 }}
      >
        <svg
          width={size}
          height={size * 0.7}
          viewBox={`0 0 ${size} ${size * 0.7}`}
          className="overflow-visible"
        >
          <defs>
            {/* Base track gradient — neutral semantic */}
            <linearGradient id={`baseGradient-${uniqueId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.18" />
              <stop offset="50%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.12" />
            </linearGradient>

            {/* Progress gradient — RIVO orange (primary) */}
            <linearGradient id={`progressGradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
              <stop offset="50%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--destructive))" />
            </linearGradient>

            {/* Soft drop shadow */}
            <filter id={`dropshadow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="3"
                floodColor="hsl(var(--primary))"
                floodOpacity="0.35"
              />
            </filter>
          </defs>

          {/* Inner thin guide line */}
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

          {/* Animated extending tick line */}
          <motion.line
            x1={lineX1}
            y1={lineY1}
            x2={lineX2}
            y2={lineY2}
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>

        {/* Animated percentage */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.div
            className="font-bold tracking-tight leading-none text-primary"
            style={{ fontSize: `${fontSize}px` }}
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

        {/* 0% / 100% labels */}
        <div
          className="absolute text-muted-foreground font-medium"
          style={{
            fontSize: `${labelFontSize}px`,
            left: center - radius - 4,
            top: center + strokeWidth / 2 + 2,
          }}
        >
          0%
        </div>
        <div
          className="absolute text-muted-foreground font-medium"
          style={{
            fontSize: `${labelFontSize}px`,
            left: center + radius - labelFontSize * 1.8,
            top: center + strokeWidth / 2 + 2,
          }}
        >
          100%
        </div>
      </div>

      {/* Meta */}
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

        <p className="text-[9px] text-muted-foreground text-center mt-0.5">
          {firstDay} à {lastDayStr}
        </p>
      </div>
    </div>
  );
};

export default MetaGaugeCard;
