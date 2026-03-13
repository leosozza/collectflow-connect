import { Badge } from "@/components/ui/badge";
import { Flame, Sun, Snowflake } from "lucide-react";

interface LeadScoreBadgeProps {
  score: number;
  showScore?: boolean;
}

const LeadScoreBadge = ({ score, showScore = true }: LeadScoreBadgeProps) => {
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore >= 80) {
    return (
      <Badge className="bg-red-500/15 text-red-600 border-red-500/30 gap-1">
        <Flame className="w-3 h-3" />
        Quente{showScore && ` (${clampedScore})`}
      </Badge>
    );
  }

  if (clampedScore >= 50) {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1">
        <Sun className="w-3 h-3" />
        Morno{showScore && ` (${clampedScore})`}
      </Badge>
    );
  }

  return (
    <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 gap-1">
      <Snowflake className="w-3 h-3" />
      Frio{showScore && ` (${clampedScore})`}
    </Badge>
  );
};

export default LeadScoreBadge;
