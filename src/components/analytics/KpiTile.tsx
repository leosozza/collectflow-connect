import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold leading-tight">
        {label}
      </p>
    </div>
    <p className={cn("text-xl font-bold text-foreground tabular-nums leading-tight tracking-tight break-words", valueClassName)}>
      {value}
    </p>
    {hint && <p className="text-[10px] text-muted-foreground leading-tight">{hint}</p>}
  </div>
);
