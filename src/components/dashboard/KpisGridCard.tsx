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
  info?: string;
}

const Tile = ({ label, value, Icon, iconColor, iconBg, trend, info }: TileProps) => (
  <div
    title={info}
    className="bg-card rounded-2xl border border-border/50 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] hover:shadow-[0_2px_8px_-2px_rgb(0_0_0_/_0.08)] transition-shadow px-3 py-2.5 flex flex-col justify-between min-w-0 h-full overflow-hidden cursor-help"
  >
    <div className="min-w-0">
      <div className={cn("rounded-lg p-1.5 inline-flex shrink-0 mb-1.5", iconBg)}>
        <Icon className={cn("w-3.5 h-3.5", iconColor)} strokeWidth={2.25} />
      </div>
      <p className="text-[10.5px] text-muted-foreground/90 font-medium leading-tight mb-0.5 truncate tracking-tight">
        {label}
      </p>
      <p className="font-semibold text-foreground tabular-nums leading-tight tracking-tight break-words text-[15px]">
        {value}
      </p>
    </div>
    {trend ? (
      <div className="mt-1 text-[9.5px] flex items-center gap-1 flex-wrap leading-tight">
        <span
          className={cn(
            "font-semibold tracking-tight tabular-nums",
            trend.isPositive ? "text-emerald-600" : "text-red-500"
          )}
        >
          {trend.value}
        </span>
        {trend.text && (
          <span className="text-muted-foreground/70 font-normal truncate">
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
        info="CPFs únicos com interação registrada hoje (carteira ou atendimento) que ainda NÃO fecharam acordo."
      />
      <Tile
        label="Acordos do Dia"
        value={acordosDia}
        Icon={FileText}
        iconColor="text-emerald-500"
        iconBg="bg-emerald-500/10"
        trend={trendAcordosDia ? { ...trendAcordosDia, text: "vs ontem" } : null}
        info="Acordos criados hoje, excluindo cancelados e rejeitados."
      />
      <Tile
        label="Acordos do Mês"
        value={acordosMes}
        Icon={CalendarCheck}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        trend={trendAcordosMes ? { ...trendAcordosMes, text: "vs mês anterior" } : null}
        info="Acordos criados no mês selecionado, excluindo cancelados e rejeitados."
      />
      <Tile
        label="Total de Quebra"
        value={formatCurrency(quebra)}
        Icon={TrendingDown}
        iconColor="text-red-500"
        iconBg="bg-red-500/10"
        trend={trendQuebra ? { ...trendQuebra, text: "vs mês anterior" } : null}
        info="Parcelas do mês não pagas, em 2 estágios. PROVISÓRIA (4-10 dias de atraso): pode voltar para Pendentes se a data for reagendada, ou para Recebido se for paga. DEFINITIVA (acordo cancelado pelo prazo do cadastro ou atraso > 10 dias): trava como prejuízo e os boletos pendentes são cancelados na Negociarie automaticamente."
      />
      <Tile
        label="Pendentes"
        value={formatCurrency(pendentes)}
        Icon={Hourglass}
        iconColor="text-amber-500"
        iconBg="bg-amber-500/10"
        trend={trendPendentes ? { ...trendPendentes, text: "vs mês anterior" } : null}
        info="Parcelas do mês ainda não pagas, com vencimento futuro ou atrasado em até 3 dias. A partir do 4º dia de atraso a parcela entra em Quebra (Provisória)."
      />
      <Tile
        label="Colchão de Acordos"
        value={formatCurrency(colchao)}
        Icon={Wallet}
        iconColor="text-indigo-500"
        iconBg="bg-indigo-500/10"
        info="Soma das parcelas com vencimento no mês originadas de acordos vivos criados em meses anteriores (entrada + parcelas mensais)."
      />
    </div>
  );
};

export default KpisGridCard;
