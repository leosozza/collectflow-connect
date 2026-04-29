import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useId } from "react";
import { formatCurrency } from "@/lib/formatters";

interface MetaRadialCardProps {
  percent: number;
  received: number;
  goal: number;
  monthLabel: string;
  year?: number;
  month?: number;
  size?: number;
  duration?: number;
}

/**
 * Meta do mês: meta no topo + radial chart centralizado.
 */
const MetaRadialCard = ({
  percent,
  goal,
  year,
  month,
  size = 240,
  duration = 1.4,
}: MetaRadialCardProps) => {
  const uid = useId().replace(/:/g, "");
  const clampedPct = Math.min(100, Math.max(0, percent));

  const strokeWidth = Math.max(14, size * 0.09);
  const radius = size * 0.38;
  const center = size / 2;
  const circumference = Math.PI * radius;

  const animatedValue = useMotionValue(0);
  const offset = useTransform(animatedValue, [0, 100], [circumference, 0]);
  const displayValue = useTransform(animatedValue, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(animatedValue, clampedPct, {
      duration,
      ease: "easeOut",
    });
    return controls.stop;
  }, [clampedPct, animatedValue, duration]);

  const fontSize = Math.max(28, size * 0.2);
  const labelFontSize = Math.max(10, size * 0.05);

  const ref = year && month ? new Date(year, month - 1, 1) : new Date();
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const firstDay = `01/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;

  const chartH = size * 0.62;

  return (
    <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
      {/* Top: meta */}
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground leading-tight uppercase tracking-wide">
          Meta Recebimento
        </p>
        <p className="text-lg font-bold text-foreground tabular-nums leading-tight mt-0.5">
          {formatCurrency(goal)}
        </p>
        <p className="text-[9px] text-muted-foreground tabular-nums mt-0.5">
          {firstDay} à {lastDayStr}
        </p>
      </div>

      {/* Radial centralizado */}
      <div className="relative shrink-0" style={{ width: size, height: chartH }}>
        <svg
          width={size}
          height={chartH}
          viewBox={`0 0 ${size} ${chartH}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={`metaProgress-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
              <stop offset="100%" stopColor="hsl(var(--primary))" />
            </linearGradient>
          </defs>

          <path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.6}
          />

          <motion.path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke={`url(#metaProgress-${uid})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        <div
          className="absolute inset-0 flex items-end justify-center"
          style={{ paddingBottom: chartH * 0.06 }}
        >
          <motion.div
            className="font-bold tracking-tight text-foreground tabular-nums"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1 }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: duration * 0.6 }}
          >
            <motion.span>{displayValue}</motion.span>%
          </motion.div>
        </div>

        <div
          className="absolute text-muted-foreground font-medium tabular-nums"
          style={{
            fontSize: `${labelFontSize}px`,
            left: center - radius - 2,
            top: center + strokeWidth * 0.4,
          }}
        >
          0%
        </div>
        <div
          className="absolute text-muted-foreground font-medium tabular-nums"
          style={{
            fontSize: `${labelFontSize}px`,
            left: center + radius - labelFontSize * 1.8,
            top: center + strokeWidth * 0.4,
          }}
        >
          100%
        </div>
      </div>
    </div>
  );
};

export default MetaRadialCard;
