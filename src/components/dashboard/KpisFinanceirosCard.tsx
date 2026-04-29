import { TrendingDown, Hourglass, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface TrendData {
  value: string;
  isPositive: boolean;
  text?: string;
}

interface Props {
  quebra: number;
  pendentes: number;
  colchao: number;
  trendQuebra?: TrendData | null;
  trendPendentes?: TrendData | null;
}

interface TileProps {
  label: string;
  value: string;
  Icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: TrendData | null;
}

const Tile = ({ label, value, Icon, iconColor, iconBg, trend }: TileProps) => (
  <div className="bg-card rounded-lg px-3 py-2.5 flex flex-col justify-between min-w-0 h-full">
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className={cn("rounded-md p-1.5 shrink-0", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium leading-tight mb-1 break-words">
        {label}
      </p>
      <p className="font-bold text-foreground tabular-nums leading-tight tracking-tight break-words text-base">
        {value}
      </p>
    </div>
    {trend && (
      <div className="mt-1.5 text-[10px] flex items-center gap-1 flex-wrap leading-tight">
        <span
          className={cn(
            "font-bold tracking-tight",
            trend.isPositive ? "text-success" : "text-destructive"
          )}
        >
          {trend.value}
        </span>
        {trend.text && (
          <span className="text-muted-foreground font-medium truncate">
            {trend.text}
          </span>
        )}
      </div>
    )}
  </div>
);

const KpisFinanceirosCard = ({
  quebra,
  pendentes,
  colchao,
  trendQuebra,
  trendPendentes,
}: Props) => {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-1.5 h-full">
      <div className="grid grid-cols-3 gap-1.5 h-full">
        <Tile
          label="Total de Quebra"
          value={formatCurrency(quebra)}
          Icon={TrendingDown}
          iconColor="text-red-500"
          iconBg="bg-red-500/10"
          trend={trendQuebra ? { ...trendQuebra, text: "vs mês anterior" } : null}
        />
        <Tile
          label="Pendentes"
          value={formatCurrency(pendentes)}
          Icon={Hourglass}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
          trend={trendPendentes ? { ...trendPendentes, text: "vs mês anterior" } : null}
        />
        <Tile
          label="Colchão de Acordos"
          value={formatCurrency(colchao)}
          Icon={Wallet}
          iconColor="text-indigo-500"
          iconBg="bg-indigo-500/10"
        />
      </div>
    </div>
  );
};

export default KpisFinanceirosCard;
