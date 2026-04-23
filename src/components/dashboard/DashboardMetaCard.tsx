import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyGoal, fetchGoals } from "@/services/goalService";
import { Trophy } from "lucide-react";
import MetaGaugeCard from "./MetaGaugeCard";

interface DashboardMetaCardProps {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  selectedOperatorUserId: string | null; // user_id from global filter
  received: number; // total_recebido from dashboard RPC
}

const DashboardMetaCard = ({
  year,
  month,
  monthLabel,
  selectedOperatorUserId,
  received,
}: DashboardMetaCardProps) => {
  const { profile } = useAuth();
  const { isTenantAdmin } = useTenant();

  // Operator: own goal
  const { data: myGoal } = useQuery({
    queryKey: ["dash-meta-my-goal", year, month, profile?.id],
    queryFn: () => fetchMyGoal(year, month),
    enabled: !isTenantAdmin && !!profile?.id,
  });

  // Admin: all goals for the period
  const { data: allGoals = [] } = useQuery({
    queryKey: ["dash-meta-goals", year, month],
    queryFn: () => fetchGoals(year, month, null),
    enabled: isTenantAdmin,
  });

  // Admin + 1 operator: resolve user_id -> profile.id and name
  const { data: selectedProfile } = useQuery({
    queryKey: ["dash-meta-profile-by-user", selectedOperatorUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", selectedOperatorUserId!)
        .maybeSingle();
      return data;
    },
    enabled: isTenantAdmin && !!selectedOperatorUserId,
  });

  const { goal, title } = useMemo(() => {
    if (!isTenantAdmin) {
      return {
        goal: Number(myGoal?.target_amount || 0),
        title: "Minha Meta do Mês",
      };
    }
    if (selectedOperatorUserId && selectedProfile?.id) {
      const opGoal = allGoals.find((g) => g.operator_id === selectedProfile.id);
      return {
        goal: Number(opGoal?.target_amount || 0),
        title: `Meta — ${selectedProfile.full_name || "Operador"}`,
      };
    }
    const total = allGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
    return { goal: total, title: "Meta — Total da Empresa" };
  }, [isTenantAdmin, myGoal, allGoals, selectedOperatorUserId, selectedProfile]);

  const pct = goal > 0 ? Math.min(100, Math.round((received / goal) * 100)) : 0;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm w-full">
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-card-foreground">{title}</h2>
        </div>
      </div>

      <div className="p-5">
        {goal === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhuma meta definida para este período.
          </div>
        ) : (
          <MetaGaugeCard
            percent={pct}
            received={received}
            goal={goal}
            monthLabel={monthLabel}
            year={year}
            month={month}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardMetaCard;
