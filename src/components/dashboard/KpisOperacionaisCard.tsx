import { Phone, FileText, CalendarCheck, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Trend {
  value: string;
  text: string;
  isPositive: boolean;
}

interface Props {
  acionadosHoje: number;
  acordosDia: number;
  acordosMes: number;
  trendAcionados?: { value: string; isPositive: boolean } | null;
  trendAcordosDia?: { value: string; isPositive: boolean } | null;
  trendAcordosMes?: { value: string; isPositive: boolean } | null;
}

interface TileProps {
  label: string;
  value: number | string;
  Icon: React.ElementType;
  gradient: string;
  trend?: { value: string; isPositive: boolean } | null;
  trendText: string;
}

const Tile = ({ label, value, Icon, gradient, trend, trendText }: TileProps) => {
  const TrendIcon = !trend ? Minus : trend.isPositive ? TrendingUp : TrendingDown;
  return (
    <div
      className={cn(
        "rounded-xl p-3 flex flex-col justify-between min-w-0 overflow-hidden text-white shadow-md",
        gradient
      )}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="text-[11px] font-semibold leading-tight opacity-95 break-words">
          {label}
        </p>
        <div className="rounded-md p-1.5 bg-white/20 shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums leading-tight tracking-tight mt-2 break-words">
        {value}
      </p>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] opacity-95 min-w-0">
        <TrendIcon className="w-3 h-3 shrink-0" />
        <span className="font-bold tabular-nums">
          {trend?.value ?? "—"}
        </span>
        <span className="opacity-90 truncate">{trendText}</span>
      </div>
    </div>
  );
};

const KpisOperacionaisCard = ({
  acionadosHoje,
  acordosDia,
  acordosMes,
  trendAcionados,
  trendAcordosDia,
  trendAcordosMes,
}: Props) => {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-2 h-full">
      <div className="grid grid-cols-3 gap-2 h-full">
        <Tile
          label="Acionados Hoje"
          value={acionadosHoje}
          Icon={Phone}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={trendAcionados}
          trendText="vs ontem"
        />
        <Tile
          label="Acordos do Dia"
          value={acordosDia}
          Icon={FileText}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
          trend={trendAcordosDia}
          trendText="vs ontem"
        />
        <Tile
          label="Acordos do Mês"
          value={acordosMes}
          Icon={CalendarCheck}
          gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={trendAcordosMes}
          trendText="vs mês ant."
        />
      </div>
    </div>
  );
};

export default KpisOperacionaisCard;
