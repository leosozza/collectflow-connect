import { Eye, TrendingUp, Hourglass, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import DashboardCardHeader from "./DashboardCardHeader";

interface Props {
  provisionado: number;
  pendentes: number;
  quebra: number;
  monthLabel?: string;
}

interface Indicator {
  key: string;
  label: string;
  value: number;
  color: string; // HSL string
  bg: string; // bg/tint
  Icon: React.ElementType;
}

const Visao360Card = ({ provisionado, pendentes, quebra, monthLabel }: Props) => {
  const indicators: Indicator[] = [
    {
      key: "provisionado",
      label: "Provisionado no Mês",
      value: provisionado,
      color: "hsl(var(--primary))",
      bg: "hsl(var(--primary) / 0.10)",
      Icon: TrendingUp,
    },
    {
      key: "pendentes",
      label: "Pendentes",
      value: pendentes,
      color: "hsl(var(--warning))",
      bg: "hsl(var(--warning) / 0.10)",
      Icon: Hourglass,
    },
    {
      key: "quebra",
      label: "Quebra",
      value: quebra,
      color: "hsl(var(--destructive))",
      bg: "hsl(var(--destructive) / 0.10)",
      Icon: TrendingDown,
    },
  ];

  const maxValue = Math.max(...indicators.map((i) => i.value), 1);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] w-full h-full min-h-0 flex flex-col overflow-hidden">
      <DashboardCardHeader
        icon={Eye}
        title="Visão 360"
        right={
          monthLabel ? (
            <span className="text-[10px] text-white/60 tracking-wide capitalize">
              {monthLabel}
            </span>
          ) : null
        }
      />

      <div className="flex flex-col justify-center gap-4 flex-1 min-h-0 p-4">
        {indicators.map(({ key, label, value, color, bg, Icon }) => {
          const widthPct = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="rounded-md p-1.5 inline-flex shrink-0"
                    style={{ backgroundColor: bg }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color }}
                      strokeWidth={2.5}
                    />
                  </span>
                  <span className="text-[12px] font-medium text-foreground truncate">
                    {label}
                  </span>
                </span>
                <span
                  className="text-sm font-bold tabular-nums shrink-0"
                  style={{ color }}
                >
                  {formatCurrency(value)}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: color,
                    boxShadow: `0 1px 6px ${color}`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Visao360Card;
