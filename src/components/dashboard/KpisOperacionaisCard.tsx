import { Phone, FileText, CalendarCheck, Receipt, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  acionadosHoje: number;
  acordosDia: number;
  acordosMes: number;
  ticketMedioDia: number;
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
}

const Tile = ({ label, value, Icon, gradient, trend }: TileProps) => {
  const TrendIcon = !trend ? Minus : trend.isPositive ? TrendingUp : TrendingDown;
  const isMoney = typeof value === "string" && value.startsWith("R$");
  return (
    <div
      className={cn(
        "rounded-lg p-2 flex flex-col justify-between min-w-0 overflow-hidden text-white shadow-sm h-full",
        gradient
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        <Icon className="w-3 h-3 shrink-0 opacity-90" />
        <p className="text-[9px] font-semibold leading-tight opacity-95 truncate">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "font-bold tabular-nums leading-none tracking-tight break-words",
          isMoney ? "text-sm" : "text-lg"
        )}
      >
        {value}
      </p>
      <div className="flex items-center gap-0.5 text-[9px] opacity-95 min-w-0 leading-none">
        <TrendIcon className="w-2.5 h-2.5 shrink-0" />
        <span className="font-bold tabular-nums truncate">
          {trend?.value ?? "—"}
        </span>
      </div>
    </div>
  );
};

const KpisOperacionaisCard = ({
  acionadosHoje,
  acordosDia,
  acordosMes,
  ticketMedioDia,
  trendAcionados,
  trendAcordosDia,
  trendAcordosMes,
}: Props) => {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-1.5 h-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 h-full">
        <Tile
          label="Acionados"
          value={acionadosHoje}
          Icon={Phone}
          gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          trend={trendAcionados}
        />
        <Tile
          label="Ac. Dia"
          value={acordosDia}
          Icon={FileText}
          gradient="bg-gradient-to-br from-green-500 to-green-600"
          trend={trendAcordosDia}
        />
        <Tile
          label="Ac. Mês"
          value={acordosMes}
          Icon={CalendarCheck}
          gradient="bg-gradient-to-br from-orange-500 to-orange-600"
          trend={trendAcordosMes}
        />
        <Tile
          label="Ticket Médio Dia"
          value={formatCurrency(ticketMedioDia)}
          Icon={Receipt}
          gradient="bg-gradient-to-br from-teal-500 to-cyan-600"
        />
      </div>
    </div>
  );
};

export default KpisOperacionaisCard;
