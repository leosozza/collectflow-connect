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
 * Meta do mês com radial chart animado (gradiente laranja → vermelho).
 * Lado esquerdo: meta, realizado e período.
 * Lado direito: arco semicircular animado com %.
 */
const MetaRadialCard = ({
  percent,
  received,
  goal,
  year,
  month,
  size = 170,
  duration = 1.4,
}: MetaRadialCardProps) => {
  const uid = useId().replace(/:/g, "");
  const clampedPct = Math.min(100, Math.max(0, percent));

  const strokeWidth = Math.max(10, size * 0.085);
  const radius = size * 0.36;
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

  const fontSize = Math.max(18, size * 0.14);
  const labelFontSize = Math.max(9, size * 0.055);

  // Period label
  const ref = year && month ? new Date(year, month - 1, 1) : new Date();
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const firstDay = `01/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;

  const chartH = size * 0.62;

  return (
    <div className="flex items-center justify-between gap-2 w-full h-full">
      {/* Left: meta / realizado / período */}
      <div className="flex flex-col gap-1.5 min-w-0 shrink-0">
        <div>
          <p className="text-sm font-bold text-foreground tabular-nums leading-tight">
            {formatCurrency(goal)}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Meta Recebimento
          </p>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground tabular-nums leading-tight">
            {formatCurrency(received)}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Realizado
          </p>
        </div>
        <p className="text-[9px] text-muted-foreground tabular-nums">
          {firstDay} à {lastDayStr}
        </p>
      </div>

      {/* Right: animated radial */}
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

          {/* Track */}
          <path
            d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.6}
          />

          {/* Progress */}
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

        {/* % center */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-1"
          style={{ paddingBottom: chartH * 0.08 }}
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

        {/* 0% / 100% labels */}
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
            left: center + radius - labelFontSize * 1.6,
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
