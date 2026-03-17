import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PropensityBadgeProps {
  score: number | null | undefined;
  scoreReason?: string | null;
  size?: "sm" | "md";
}

const PropensityBadge = ({ score, scoreReason, size = "sm" }: PropensityBadgeProps) => {
  if (score === null || score === undefined) return null;

  const getColor = (s: number) => {
    if (s >= 70) return { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-400", icon: TrendingUp };
    if (s >= 40) return { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-400", icon: Minus };
    return { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-400", icon: TrendingDown };
  };

  const getLabel = (s: number) => {
    if (s >= 70) return "Alto";
    if (s >= 40) return "Médio";
    return "Baixo";
  };

  const { bg, text, icon: Icon } = getColor(score);
  const isSmall = size === "sm";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${bg} ${text} ${isSmall ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"}`}>
          <Icon className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
          {score}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">Score Operacional: {getLabel(score)} ({score}/100)</p>
        {scoreReason && <p className="text-xs text-muted-foreground mt-0.5">{scoreReason}</p>}
      </TooltipContent>
    </Tooltip>
  );
};

export default PropensityBadge;
