import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyGoal, fetchGoals } from "@/services/goalService";
import { Trophy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MetaGaugeCard from "./MetaGaugeCard";

interface DashboardMetaCardProps {
  year: number;
  month: number; // 1-12
  monthLabel: string;
}

const DashboardMetaCard = ({ year, month, monthLabel }: DashboardMetaCardProps) => {
  const { profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>("total");

  // Operator: own goal + own points
  const { data: myGoal } = useQuery({
    queryKey: ["dash-meta-my-goal", year, month, profile?.id],
    queryFn: () => fetchMyGoal(year, month),
    enabled: !isTenantAdmin && !!profile?.id,
  });

  const { data: myPoints } = useQuery({
    queryKey: ["dash-meta-my-points", profile?.id, year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_points")
        .select("total_received")
        .eq("operator_id", profile!.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      return data;
    },
    enabled: !isTenantAdmin && !!profile?.id,
  });

  // Admin: all goals + all points + operators
  const { data: allGoals = [] } = useQuery({
    queryKey: ["dash-meta-goals", year, month],
    queryFn: () => fetchGoals(year, month, null),
    enabled: isTenantAdmin,
  });

  const { data: allPoints = [] } = useQuery({
    queryKey: ["dash-meta-points-all", year, month, tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("operator_points")
        .select("operator_id, total_received")
        .eq("year", year)
        .eq("month", month);
      return data || [];
    },
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { data: operators = [] } = useQuery({
    queryKey: ["dash-meta-operators", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      return data || [];
    },
    enabled: isTenantAdmin && !!tenant?.id,
  });

  const { goal, received } = useMemo(() => {
    if (!isTenantAdmin) {
      return {
        goal: myGoal?.target_amount || 0,
        received: Number(myPoints?.total_received || 0),
      };
    }
    if (selectedOperatorId === "total") {
      const g = allGoals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
      const r = allPoints.reduce((s: number, p: any) => s + Number(p.total_received || 0), 0);
      return { goal: g, received: r };
    }
    const opGoal = allGoals.find((g) => g.operator_id === selectedOperatorId);
    const opPoints = (allPoints as any[]).find((p) => p.operator_id === selectedOperatorId);
    return {
      goal: Number(opGoal?.target_amount || 0),
      received: Number(opPoints?.total_received || 0),
    };
  }, [isTenantAdmin, myGoal, myPoints, allGoals, allPoints, selectedOperatorId]);

  const pct = goal > 0 ? Math.min(100, Math.round((received / goal) * 100)) : 0;

  // Operators that have a goal in this month, for the dropdown
  const operatorsWithGoals = useMemo(() => {
    const goalIds = new Set(allGoals.map((g) => g.operator_id));
    return (operators as any[]).filter((op) => goalIds.has(op.id));
  }, [operators, allGoals]);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm w-full md:w-1/2">
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-card-foreground">
              {isTenantAdmin ? "Metas" : "Minha Meta do Mês"}
            </h2>
          </div>
          {isTenantAdmin && (
            <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total da Empresa</SelectItem>
                {operatorsWithGoals.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.full_name || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
