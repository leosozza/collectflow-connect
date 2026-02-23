import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Percent, Wallet, FileText } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  icon: "projected" | "received" | "broken" | "commission" | "receivable" | "percent" | "agreement";
  trend?: string;
}

const iconMap = {
  projected: DollarSign,
  received: TrendingUp,
  broken: TrendingDown,
  commission: Wallet,
  receivable: DollarSign,
  percent: Percent,
  agreement: FileText,
};

const colorMap = {
  projected: "text-primary",
  received: "text-success",
  broken: "text-destructive",
  commission: "text-warning",
  receivable: "text-primary",
  percent: "text-muted-foreground",
  agreement: "text-accent-foreground",
};

const bgMap = {
  projected: "bg-primary/10",
  received: "bg-success/10",
  broken: "bg-destructive/10",
  commission: "bg-warning/10",
  receivable: "bg-primary/10",
  percent: "bg-muted",
  agreement: "bg-accent",
};

const StatCard = ({ title, value, icon, trend }: StatCardProps) => {
  const Icon = iconMap[icon];
  const color = colorMap[icon];
  const bg = bgMap[icon];

  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-card-foreground">{value}</p>
      {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
    </div>
  );
};

export default StatCard;
