import { Phone, FileText, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { trendToneClass, type TrendTone } from "@/lib/trendFormat";

interface TrendData {
  value: string;
  tone: TrendTone;
  isPositive?: boolean;
  text?: string;
}

interface Props {
  acionadosHoje: number;
  acordosDia: number;
  acordosMes: number;
  trendAcionados?: TrendData | null;
  trendAcordosDia?: TrendData | null;
  trendAcordosMes?: TrendData | null;
  compareLabel?: string;
}

interface TileProps {
  label: string;
  value: string | number;
  Icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: TrendData | null;
  info?: string;
}

const Tile = ({ label, value, Icon, iconColor, iconBg, trend, info }: TileProps) => {
  return (
    <div
      title={info}
      className="relative bg-gradient-to-br from-primary/[0.06] via-card to-card rounded-2xl border border-border/50 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] transition-all px-2 py-2 xl:px-3 xl:py-3 flex flex-col justify-between min-w-0 h-full overflow-hidden cursor-help hover:border-primary/40 hover:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.22)]"
    >
      <span aria-hidden className="absolute top-0 left-0 bottom-0 w-[3px] bg-secondary rounded-r-full" />
      <div className="min-w-0 flex items-start justify-between gap-2">
        <p className="text-[10px] text-muted-foreground/80 font-medium leading-tight truncate tracking-[0.06em] uppercase">
          {label}
        </p>
        <div className={cn("rounded-md p-1 inline-flex shrink-0", iconBg)}>
          <Icon className={cn("w-3 h-3", iconColor)} strokeWidth={2.25} />
        </div>
      </div>
      <p className="font-extrabold text-foreground tabular-nums leading-none tracking-tight mt-0.5 truncate text-[22px] lg:text-[24px] xl:text-[28px] 2xl:text-[40px]">
        {value}
      </p>
      {trend ? (
        <div className="mt-1 text-[10px] flex items-center gap-1 flex-wrap leading-tight">
          <span
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              trendToneClass[trend.tone]
            )}
          >
            {trend.value}
          </span>
          {trend.text && (
            <span className="text-muted-foreground/55 font-normal truncate">
              {trend.text}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-1 h-3" />
      )}
    </div>
  );
};

const KpisGridCard = ({
  acionadosHoje,
  acordosDia,
  acordosMes,
  trendAcionados,
  trendAcordosDia,
  trendAcordosMes,
  compareLabel = "vs mês anterior",
}: Props) => {
  return (
    <div className="grid grid-cols-1 gap-2 h-full min-h-0">
      <Tile
        label="Acionados Hoje"
        value={acionadosHoje}
        Icon={Phone}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        trend={trendAcionados ? { ...trendAcionados, text: "vs ontem" } : null}
        info="CPFs únicos com interação registrada hoje (carteira ou atendimento) que ainda NÃO fecharam acordo."
      />
      <Tile
        label="Acordos do Dia"
        value={acordosDia}
        Icon={FileText}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        trend={trendAcordosDia ? { ...trendAcordosDia, text: "vs ontem" } : null}
        info="Acordos criados hoje, excluindo cancelados e rejeitados."
      />
      <Tile
        label="Acordos do Mês"
        value={acordosMes}
        Icon={CalendarCheck}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        trend={trendAcordosMes ? { ...trendAcordosMes, text: "vs mês anterior" } : null}
        info="Acordos criados no mês selecionado, excluindo cancelados e rejeitados."
      />
    </div>
  );
};

export default KpisGridCard;
