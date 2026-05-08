import { Eye, TrendingUp, Hourglass, TrendingDown, Wallet, Sigma } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import DashboardCardHeader from "./DashboardCardHeader";

interface Props {
  colchao: number;
  provisionado: number;
  pendentes: number;
  quebra: number;
  monthLabel?: string;
}

interface Indicator {
  key: string;
  label: string;
  value: number;
  color: string;
  bg: string;
  Icon: React.ElementType;
}

const Visao360Card = ({ colchao, provisionado, pendentes, quebra, monthLabel }: Props) => {
  const totalPrevisto = colchao + provisionado;

  const indicators: Indicator[] = [
    {
      key: "colchao",
      label: "Colchão de Acordos",
      value: colchao,
      color: "hsl(var(--primary))",
      bg: "hsl(var(--primary) / 0.10)",
      Icon: Wallet,
    },
    {
      key: "provisionado",
      label: "Provisionado no Mês",
      value: provisionado,
      color: "hsl(var(--primary))",
      bg: "hsl(var(--primary) / 0.10)",
      Icon: TrendingUp,
    },
  ];

  const lowerIndicators: Indicator[] = [
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

  const allBars = [...indicators, ...lowerIndicators];
  const maxValue = Math.max(...allBars.map((i) => i.value), 1);

  const renderRow = ({ key, label, value, color, bg, Icon }: Indicator) => {
    const widthPct = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);
    return (
      <div key={key} className="space-y-1 flex-1 min-h-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 xl:gap-2 min-w-0">
            <span
              className="rounded-md p-1 xl:p-1.5 inline-flex shrink-0"
              style={{ backgroundColor: bg }}
            >
              <Icon
                className="w-3 h-3 xl:w-3.5 xl:h-3.5"
                style={{ color }}
                strokeWidth={2.5}
              />
            </span>
            <span className="text-[11px] xl:text-[12px] font-medium text-foreground truncate">
              {label}
            </span>
          </span>
          <span
            className="text-[12px] xl:text-sm font-bold tabular-nums shrink-0"
            style={{ color }}
          >
            {formatCurrency(value)}
          </span>
        </div>
        <div className="h-1.5 xl:h-2 w-full rounded-full bg-muted/50 overflow-hidden">
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
  };

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

      <div className="flex flex-col gap-2 xl:gap-2.5 flex-1 min-h-0 p-3 xl:p-4">
        {indicators.map(renderRow)}

        {/* Linha-resumo: Total Previsto no Mês */}
        <div
          className="rounded-lg bg-primary border border-primary px-2.5 py-2 xl:px-3 xl:py-2.5 flex flex-col items-center justify-center gap-0.5 text-primary-foreground shadow-sm"
          style={{ flex: "1.3 1 0%" }}
          title="Soma do Colchão com o Provisionado do mês — previsão total de entrada."
        >
          <span className="flex items-center gap-1.5 xl:gap-2">
            <Sigma className="w-3.5 h-3.5 xl:w-4 xl:h-4" strokeWidth={2.5} />
            <span className="text-[11px] xl:text-[12px] font-semibold uppercase tracking-wide">
              Colchão + Provisionado
            </span>
          </span>
          <span className="text-lg xl:text-xl font-bold tabular-nums">
            {formatCurrency(totalPrevisto)}
          </span>
        </div>

        {lowerIndicators.map(renderRow)}
      </div>
    </div>
  );
};

export default Visao360Card;
