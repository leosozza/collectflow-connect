import { useQuery } from "@tanstack/react-query";
import { fetchMyGoal } from "@/services/goalService";
import { formatCurrency } from "@/lib/formatters";
import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Props {
  year: number;
  month: number;
  totalRecebido: number;
}

const GoalProgress = ({ year, month, totalRecebido }: Props) => {
  const { data: goal } = useQuery({
    queryKey: ["my-goal", year, month],
    queryFn: () => fetchMyGoal(year, month),
  });

  if (!goal || goal.target_amount <= 0) return null;

  const pct = Math.min((totalRecebido / goal.target_amount) * 100, 100);
  const remaining = Math.max(goal.target_amount - totalRecebido, 0);

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-card-foreground">Meta do Mês</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatCurrency(totalRecebido)} / {formatCurrency(goal.target_amount)}
        </span>
      </div>
      <Progress value={pct} className="h-3" />
      <div className="flex justify-between mt-2">
        <span className="text-xs text-muted-foreground">{pct.toFixed(1)}% atingido</span>
        <span className="text-xs text-muted-foreground">Faltam {formatCurrency(remaining)}</span>
      </div>
    </div>
  );
};

export default GoalProgress;
