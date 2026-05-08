import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  title: string;
  right?: ReactNode;
  className?: string;
}

/**
 * Header padronizado RIVO: fundo escuro + chip primary do ícone + título uppercase.
 */
const DashboardCardHeader = ({ icon: Icon, title, right, className }: Props) => {
  return (
    <div
      className={cn(
        "px-3 py-1.5 xl:px-4 xl:py-2.5 shrink-0 bg-secondary text-secondary-foreground flex items-center gap-2",
        className
      )}
    >
      <div className="rounded-lg p-1 xl:p-1.5 inline-flex bg-primary/15 ring-1 ring-primary/30 shrink-0">
        <Icon className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-primary" strokeWidth={2.5} />
      </div>
      <h2 className="text-[11px] xl:text-[12px] font-semibold tracking-[0.04em] uppercase text-white/95 truncate">
        {title}
      </h2>
      {right && <div className="ml-auto flex items-center gap-2 min-w-0">{right}</div>}
    </div>
  );
};

export default DashboardCardHeader;
