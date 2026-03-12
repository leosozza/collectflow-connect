import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useGamification } from "@/hooks/useGamification";
import { fetchMyGoal } from "@/services/goalService";

export const useGamificationTrigger = () => {
  const { profile } = useAuth();
  const { tenantUser } = useTenant();
  const { checkAndGrantAchievements } = useGamification();

  const triggerGamificationUpdate = useCallback(async () => {
    if (!profile?.id || !tenantUser?.tenant_id) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    try {
      // Payments this month (clients with data_quitacao in current month linked to operator)
      const { count: paymentsCount } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("operator_id", profile.id)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);

      // Total received this month
      const { data: receivedData } = await supabase
        .from("clients")
        .select("valor_pago")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("operator_id", profile.id)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);

      const totalReceived = (receivedData || []).reduce((sum, c) => sum + (c.valor_pago || 0), 0);

      // Breaks this month (cancelled agreements)
      const { count: breaksCount } = await supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("created_by", profile.id)
        .eq("status", "cancelled")
        .gte("updated_at", monthStart)
        .lt("updated_at", nextMonth);

      // Check if goal reached
      const goal = await fetchMyGoal(year, month);
      const isGoalReached = goal ? totalReceived >= goal.target_amount : false;

      await checkAndGrantAchievements({
        paymentsThisMonth: paymentsCount || 0,
        totalReceived,
        breaksThisMonth: breaksCount || 0,
        isGoalReached,
      });
    } catch (err) {
      console.error("Gamification trigger error:", err);
    }
  }, [profile?.id, tenantUser?.tenant_id, checkAndGrantAchievements]);

  return { triggerGamificationUpdate };
};
