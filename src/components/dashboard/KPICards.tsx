import { TrendingUp, TrendingDown, Minus, Award, Target, Clock, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface KPI {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: number; // positive = up, negative = down
}

interface Props {
  kpis: KPI[];
}

const TrendIndicator = ({ trend }: { trend?: number }) => {
  if (trend === undefined || trend === 0) return <Minus className="w-3 h-3 text-muted-foreground" />;
  if (trend > 0) return <TrendingUp className="w-3 h-3 text-success" />;
  return <TrendingDown className="w-3 h-3 text-destructive" />;
};

const KPICards = ({ kpis }: Props) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((kpi, i) => {
        const Icon = kpi.icon;
        return (
          <div key={i} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <Icon className="w-4 h-4 text-primary" />
              <TrendIndicator trend={kpi.trend} />
            </div>
            <p className="text-lg font-bold text-foreground">{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        );
      })}
    </div>
  );
};

export { KPICards, type KPI };
export default KPICards;
