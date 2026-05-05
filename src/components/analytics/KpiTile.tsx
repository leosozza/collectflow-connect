import { ReactNode } from "react";
import { LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  iconClassName?: string;
  valueClassName?: string;
}

export const KpiTile = ({ label, value, icon: Icon, hint, iconClassName, valueClassName }: KpiTileProps) => (
  <div className="bg-card rounded-xl border border-border shadow-sm px-4 py-3 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      {Icon && (
        <div className={cn("rounded-md p-1.5 bg-primary/10 shrink-0", iconClassName)}>
          <Icon className="w-4 h-4 text-primary" />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold leading-tight">
          {label}
        </p>
        {hint && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-primary transition-colors cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[220px]">
                <p className="text-xs">{hint}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
    <p className={cn("text-xl font-bold text-foreground tabular-nums leading-tight tracking-tight break-words", valueClassName)}>
      {value}
    </p>
  </div>
);
