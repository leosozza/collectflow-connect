import { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AnalyticsCardHeaderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export const AnalyticsCardHeader = ({ title, description, children }: AnalyticsCardHeaderProps) => (
  <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-4 h-4 text-muted-foreground/60 hover:text-primary transition-colors cursor-help shrink-0" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[280px]">
            <p className="text-xs">{description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    {children}
  </div>
);
