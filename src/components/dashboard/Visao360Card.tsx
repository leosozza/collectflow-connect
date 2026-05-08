import { Eye, TrendingUp, Hourglass, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

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
  colorVar: string;
  Icon: React.ElementType;
}

const Visao360Card = ({ provisionado, pendentes, quebra, monthLabel }: Props) => {
  const indicators: Indicator[] = [
    {
      key: "provisionado",
      label: "Provisionado no Mês",
      value: provisionado,
      colorVar: "hsl(var(--primary))",
      Icon: TrendingUp,
    },
    {
      key: "pendentes",
      label: "Pendentes",
      value: pendentes,
      colorVar: "hsl(38 92% 50%)",
      Icon: Hourglass,
    },
    {
      key: "quebra",
      label: "Quebra",
      value: quebra,
      colorVar: "hsl(0 84% 60%)",
      Icon: TrendingDown,
    },
  ];

  const maxValue = Math.max(...indicators.map((i) => i.value), 1);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] h-full min-h-0 flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" strokeWidth={2.25} />
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Visão 360
            </h3>
          </div>
          {monthLabel && (
            <p className="text-[10px] text-muted-foreground/70 capitalize mt-0.5 truncate">
              {monthLabel}
            </p>
          )}
        </div>
      </div>

      {/* Barras horizontais */}
      <div className="flex flex-col justify-center gap-3 flex-1 min-h-0">
        {indicators.map(({ key, label, value, colorVar, Icon }) => {
          const widthPct = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground font-medium truncate">
                  <Icon
                    className="w-3 h-3 shrink-0"
                    style={{ color: colorVar }}
                    strokeWidth={2.25}
                  />
                  <span className="truncate">{label}</span>
                </span>
                <span
                  className="font-bold tabular-nums shrink-0"
                  style={{ color: colorVar }}
                >
                  {formatCurrency(value)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: colorVar,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-around gap-2 shrink-0">
        {indicators.map(({ key, label, colorVar }) => (
          <div key={key} className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: colorVar }}
            />
            <span className="text-[10px] text-muted-foreground truncate">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Visao360Card;
