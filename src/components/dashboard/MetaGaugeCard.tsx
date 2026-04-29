import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
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

/**
 * Velocímetro tricolor (vermelho → amarelo → verde) com ponteiro animado.
 * Lado esquerdo: Meta Recebimento, Realizado e período.
 * Lado direito: gauge semicircular com %.
 */
const MetaGaugeCard = ({
  percent,
  received,
  goal,
  year,
  month,
  size = 180,
  duration = 1.4,
}: MetaGaugeCardProps) => {
  const clampedPct = Math.min(100, Math.max(0, percent));

  // Geometry
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h * 0.92;
  const radius = size * 0.4;
  const strokeWidth = Math.max(16, size * 0.1);

  // Convert pct (0..100) → angle in radians along upper semicircle (180° → 0°)
  const angleFromPct = (p: number) => Math.PI - (p / 100) * Math.PI;

  const arcPath = (startPct: number, endPct: number) => {
    const a1 = angleFromPct(startPct);
    const a2 = angleFromPct(endPct);
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy - radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy - radius * Math.sin(a2);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  };

  // Animated needle: -90° (0%) → +90° (100%)
  const animatedValue = useMotionValue(0);
  const needleAngleDeg = useTransform(
    animatedValue,
    (v) => -90 + (v / 100) * 180
  );
  const displayPct = useTransform(animatedValue, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(animatedValue, clampedPct, {
      duration,
      ease: "easeOut",
    });
    return controls.stop;
  }, [clampedPct, animatedValue, duration]);

  // Period label
  const ref = year && month ? new Date(year, month - 1, 1) : new Date();
  const m = ref.getMonth();
  const y = ref.getFullYear();
  const firstDay = `01/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const lastDayStr = `${lastDay}/${String(m + 1).padStart(2, "0")}/${String(y).slice(-2)}`;

  const needleLength = radius - strokeWidth * 0.4;
  const hubRadius = Math.max(8, size * 0.05);

  return (
    <div className="flex items-center justify-between gap-2 w-full h-full">
      {/* Left: meta / realizado / período */}
      <div className="flex flex-col gap-2 min-w-0 shrink-0">
        <div>
          <p className="text-base font-bold text-foreground tabular-nums leading-tight">
            {formatCurrency(goal)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Meta Recebimento
          </p>
        </div>
        <div>
          <p className="text-base font-bold text-foreground tabular-nums leading-tight">
            {formatCurrency(received)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Realizado
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {firstDay} à {lastDayStr}
        </p>
      </div>

      {/* Right: speedometer */}
      <div className="relative shrink-0" style={{ width: w, height: h }}>
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="overflow-visible"
        >
          {/* Red 0..33 */}
          <path
            d={arcPath(0, 33.33)}
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
          {/* Yellow 33..66 */}
          <path
            d={arcPath(33.33, 66.66)}
            fill="none"
            stroke="hsl(48 96% 53%)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
          {/* Green 66..100 */}
          <path
            d={arcPath(66.66, 100)}
            fill="none"
            stroke="hsl(142 71% 45%)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />

          {/* Needle */}
          <motion.g
            style={{
              originX: `${cx}px`,
              originY: `${cy}px`,
              rotate: needleAngleDeg,
            }}
          >
            <polygon
              points={`${cx - 4},${cy} ${cx + 4},${cy} ${cx},${cy - needleLength}`}
              fill="hsl(var(--foreground))"
            />
          </motion.g>

          {/* Hub */}
          <circle cx={cx} cy={cy} r={hubRadius} fill="hsl(var(--foreground))" />
          <circle
            cx={cx}
            cy={cy}
            r={hubRadius * 0.45}
            fill="hsl(var(--background))"
          />
        </svg>

        {/* % label inside the arc */}
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{ left: 0, right: 0, top: h * 0.42, height: h * 0.32 }}
        >
          <motion.span
            className="text-2xl font-bold text-foreground tabular-nums"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: duration * 0.7 }}
          >
            <motion.span>{displayPct}</motion.span>%
          </motion.span>
        </div>
      </div>
    </div>
  );
};

export default MetaGaugeCard;
