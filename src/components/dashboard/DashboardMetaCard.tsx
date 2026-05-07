import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyGoal, fetchGoals } from "@/services/goalService";
import { Trophy } from "lucide-react";
import MetaRadialCard from "./MetaRadialCard";

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
        title: "Meta do Mês",
      };
    }
    if (selectedOperatorUserId && selectedProfile?.id) {
      const opGoal = allGoals.find((g) => g.operator_id === selectedProfile.id);
      return {
        goal: Number(opGoal?.target_amount || 0),
        title: "Meta do Mês",
      };
    }
    const total = allGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
    return { goal: total, title: "Meta do Mês" };
  }, [isTenantAdmin, myGoal, allGoals, selectedOperatorUserId, selectedProfile]);

  const pct = goal > 0 ? Math.min(100, Math.round((received / goal) * 100)) : 0;

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)] w-full h-full min-h-0 flex flex-col">
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-1.5 inline-flex bg-primary/10">
            <Trophy className="w-3.5 h-3.5 text-primary" strokeWidth={2.25} />
          </div>
          <h2 className="text-[13px] font-semibold text-foreground tracking-tight">{title}</h2>
        </div>
      </div>

      <div className="p-3 flex-1 min-h-0 flex items-center justify-center">
        {goal === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-xs">
            Nenhuma meta definida para este período.
          </div>
        ) : (
          <MetaRadialCard
            percent={pct}
            received={received}
            goal={goal}
            monthLabel={monthLabel}
            year={year}
            month={month}
            size={230}
            duration={1.4}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardMetaCard;
