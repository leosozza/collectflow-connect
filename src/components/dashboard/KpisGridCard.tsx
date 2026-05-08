import { Phone, FileText, CalendarCheck, TrendingDown, Hourglass, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
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
  quebra: number;
  pendentes: number;
  colchao: number;
  trendAcionados?: TrendData | null;
  trendAcordosDia?: TrendData | null;
  trendAcordosMes?: TrendData | null;
  trendQuebra?: TrendData | null;
  trendPendentes?: TrendData | null;
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
  valueSize?: "lg" | "md";
}

const Tile = ({ label, value, Icon, iconColor, iconBg, trend, info, valueSize = "md" }: TileProps) => {
  const isHero = valueSize === "lg";
  return (
    <div
      title={info}
      className={cn(
        "relative bg-card rounded-2xl border shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] transition-all px-3 py-2.5 flex flex-col justify-between min-w-0 h-full overflow-hidden cursor-help",
        isHero
          ? "border-border/50 hover:border-primary/30 hover:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.18)]"
          : "border-border/50 hover:shadow-[0_2px_8px_-2px_rgb(0_0_0_/_0.08)]"
      )}
    >
      {isHero && (
        <span
          aria-hidden
          className="absolute top-0 left-0 h-[2px] w-8 bg-primary rounded-r-full"
        />
      )}
      <div className="min-w-0 flex items-start justify-between gap-2">
        <p className="text-[10px] text-muted-foreground/80 font-medium leading-tight truncate tracking-[0.06em] uppercase">
          {label}
        </p>
        <div className={cn("rounded-md p-1 inline-flex shrink-0", iconBg)}>
          <Icon className={cn("w-3 h-3", iconColor)} strokeWidth={2.25} />
        </div>
      </div>
      <p
        className={cn(
          "font-bold text-foreground tabular-nums leading-none tracking-tight mt-0.5 truncate",
          isHero
            ? "text-[34px] lg:text-[40px] xl:text-[44px] font-extrabold"
            : "text-base lg:text-lg xl:text-xl"
        )}
      >
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
  quebra,
  pendentes,
  colchao,
  trendAcionados,
  trendAcordosDia,
  trendAcordosMes,
  trendQuebra,
  trendPendentes,
  compareLabel = "vs mês anterior",
}: Props) => {
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-2 h-full min-h-0">
      <Tile
        label="Acionados Hoje"
        value={acionadosHoje}
        Icon={Phone}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        valueSize="lg"
        trend={trendAcionados ? { ...trendAcionados, text: "vs ontem" } : null}
        info="CPFs únicos com interação registrada hoje (carteira ou atendimento) que ainda NÃO fecharam acordo."
      />
      <Tile
        label="Acordos do Dia"
        value={acordosDia}
        Icon={FileText}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        valueSize="lg"
        trend={trendAcordosDia ? { ...trendAcordosDia, text: "vs ontem" } : null}
        info="Acordos criados hoje, excluindo cancelados e rejeitados."
      />
      <Tile
        label="Acordos do Mês"
        value={acordosMes}
        Icon={CalendarCheck}
        iconColor="text-primary"
        iconBg="bg-primary/10"
        valueSize="lg"
        trend={trendAcordosMes ? { ...trendAcordosMes, text: compareLabel } : null}
        info="Acordos criados no mês selecionado, excluindo cancelados e rejeitados."
      />
      <Tile
        label="Total de Quebra"
        value={formatCurrency(quebra)}
        Icon={TrendingDown}
        iconColor="text-red-500"
        iconBg="bg-red-500/10"
        valueSize="md"
        trend={trendQuebra ? { ...trendQuebra, text: compareLabel } : null}
        info="Parcelas do mês não pagas, em 2 estágios. PROVISÓRIA (4-10 dias de atraso): pode voltar para Pendentes se a data for reagendada, ou para Recebido se for paga. DEFINITIVA (acordo cancelado pelo prazo do cadastro ou atraso > 10 dias): trava como prejuízo e os boletos pendentes são cancelados na Negociarie automaticamente."
      />
      <Tile
        label="Pendentes"
        value={formatCurrency(pendentes)}
        Icon={Hourglass}
        iconColor="text-amber-500"
        iconBg="bg-amber-500/10"
        valueSize="md"
        trend={trendPendentes ? { ...trendPendentes, text: compareLabel } : null}
        info="Parcelas do mês ainda não pagas, com vencimento futuro ou atrasado em até 3 dias. A partir do 4º dia de atraso a parcela entra em Quebra (Provisória)."
      />
      <Tile
        label="Colchão de Acordos"
        value={formatCurrency(colchao)}
        Icon={Wallet}
        iconColor="text-indigo-500"
        iconBg="bg-indigo-500/10"
        valueSize="md"
        info="Soma das parcelas com vencimento no mês originadas de acordos vivos criados em meses anteriores (entrada + parcelas mensais)."
      />
    </div>
  );
};

export default KpisGridCard;
