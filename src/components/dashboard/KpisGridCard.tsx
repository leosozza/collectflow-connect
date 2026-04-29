import { Phone, FileText, CalendarCheck, TrendingDown, Hourglass, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface TrendData {
  value: string;
  isPositive: boolean;
  text?: string;
}

interface Props {
  acionadosHoje: number;
  acordosDia: number;
  acordosMes: number;
  quebra: number;
  pendentes: number;
  colchao: number;
  trendAcionados?: TrendData | null;
  trendAcordosDia?: TrendData | null;
  trendAcordosMes?: TrendData | null;
  trendQuebra?: TrendData | null;
  trendPendentes?: TrendData | null;
}

interface TileProps {
  label: string;
  value: string | number;
  Icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: TrendData | null;
}

const Tile = ({ label, value, Icon, iconColor, iconBg, trend }: TileProps) => (
  <div className="bg-card rounded-lg border border-border/80 shadow-sm px-2.5 py-2 flex flex-col justify-between min-w-0 h-full overflow-hidden">
    <div className="min-w-0">
      <div className={cn("rounded-md p-1.5 inline-flex shrink-0 mb-1", iconBg)}>
        <Icon className={cn("w-3.5 h-3.5", iconColor)} />
      </div>
      <p className="text-[10px] text-muted-foreground font-medium leading-tight mb-0.5 truncate">
        {label}
      </p>
      <p className="font-bold text-foreground tabular-nums leading-tight tracking-tight break-words text-base">
        {value}
      </p>
    </div>
    {trend ? (
      <div className="mt-1 text-[9px] flex items-center gap-1 flex-wrap leading-tight">
        <span
          className={cn(
            "font-bold tracking-tight",
            trend.isPositive ? "text-emerald-600" : "text-destructive"
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
    ) : (
      <div className="mt-1 h-3" />
    )}
  </div>
);

const KpisGridCard = ({
  acionadosHoje,
  acordosDia,
  acordosMes,
  quebra,
  pendentes,
  colchao,
  trendAcionados,
  trendAcordosDia,
  trendAcordosMes,
  trendQuebra,
  trendPendentes,
}: Props) => {
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full min-h-0">
      <Tile
        label="Acionados Hoje"
        value={acionadosHoje}
        Icon={Phone}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        trend={trendAcionados ? { ...trendAcionados, text: "vs ontem" } : null}
      />
      <Tile
        label="Acordos do Dia"
        value={acordosDia}
        Icon={FileText}
        iconColor="text-emerald-500"
        iconBg="bg-emerald-500/10"
        trend={trendAcordosDia ? { ...trendAcordosDia, text: "vs ontem" } : null}
      />
      <Tile
        label="Acordos do Mês"
        value={acordosMes}
        Icon={CalendarCheck}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        trend={trendAcordosMes ? { ...trendAcordosMes, text: "vs mês anterior" } : null}
      />
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
  );
};

export default KpisGridCard;
