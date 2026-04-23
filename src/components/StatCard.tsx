import { TrendingUp, TrendingDown, DollarSign, Percent, Wallet, FileText, Info, Target, Phone } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: "projected" | "received" | "broken" | "commission" | "receivable" | "percent" | "agreement" | "target" | "phone";
  trend?: string;
  tooltip?: string;
  variant?: "default" | "gradient";
  compact?: boolean;
}

const iconMap = {
  projected: DollarSign,
  received: TrendingUp,
  broken: TrendingDown,
  commission: Wallet,
  receivable: DollarSign,
  percent: Percent,
  agreement: FileText,
  target: Target,
  phone: Phone,
};

const colorMap = {
  projected: "text-primary",
  received: "text-success",
  broken: "text-destructive",
  commission: "text-warning",
  receivable: "text-primary",
  percent: "text-muted-foreground",
  agreement: "text-accent-foreground",
  target: "text-primary",
  phone: "text-primary",
};

const bgMap = {
  projected: "bg-primary/10",
  received: "bg-success/10",
  broken: "bg-destructive/10",
  commission: "bg-warning/10",
  receivable: "bg-primary/10",
  percent: "bg-muted",
  agreement: "bg-accent",
  target: "bg-primary/10",
  phone: "bg-primary/10",
};

const StatCard = ({ title, value, icon, trend, tooltip, variant = "default", compact = false }: StatCardProps) => {
  const Icon = iconMap[icon];
  const color = colorMap[icon];
  const bg = bgMap[icon];
  const isGradient = variant === "gradient";

  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm animate-fade-in",
        compact ? "p-3" : "p-4",
        isGradient
          ? "gradient-orange border-transparent text-primary-foreground"
          : "bg-card border-border"
      )}
    >
      <div className={cn("flex items-center justify-between", compact ? "mb-1.5" : "mb-2")}>
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={cn(
              "font-medium truncate",
              compact ? "text-[11px]" : "text-xs",
              isGradient ? "text-primary-foreground/85" : "text-muted-foreground"
            )}
          >
            {title}
          </span>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info
                    className={cn(
                      "w-3 h-3 cursor-help shrink-0",
                      isGradient ? "text-primary-foreground/70" : "text-muted-foreground/60"
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg flex items-center justify-center shrink-0",
            compact ? "w-7 h-7" : "w-8 h-8",
            isGradient ? "bg-white/20" : bg
          )}
        >
          <Icon className={cn(compact ? "w-4 h-4" : "w-4 h-4", isGradient ? "text-primary-foreground" : color)} />
        </div>
      </div>
      <p
        className={cn(
          "font-bold tracking-tight",
          compact ? "text-lg" : "text-xl",
          isGradient ? "text-primary-foreground" : "text-card-foreground"
        )}
      >
        {value}
      </p>
      {trend && (
        <p className={cn("mt-0.5", compact ? "text-[10px]" : "text-xs", isGradient ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {trend}
        </p>
      )}
    </div>
  );
};

export default StatCard;
