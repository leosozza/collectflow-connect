import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import {
  ACHIEVEMENT_DEFINITIONS,
  calculatePoints,
  grantAchievement,
  fetchMyAchievements,
  upsertOperatorPoints,
} from "@/services/gamificationService";

interface AchievementContext {
  paymentsThisMonth: number;
  totalReceived: number;
  breaksThisMonth: number;
  isGoalReached: boolean;
}

export const useGamification = () => {
  const { profile } = useAuth();
  const { tenantUser } = useTenant();

  const checkAndGrantAchievements = useCallback(async (context: AchievementContext) => {
    if (!profile?.id || !tenantUser?.tenant_id) return;

    const profileId = profile.id;
    const tenantId = tenantUser.tenant_id;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    try {
      const earnedTitles = await fetchMyAchievements(profileId);
      const newlyUnlocked: typeof ACHIEVEMENT_DEFINITIONS = [];

      const checks: Array<{ def: typeof ACHIEVEMENT_DEFINITIONS[0]; condition: boolean }> = [
        {
          def: ACHIEVEMENT_DEFINITIONS.find(d => d.key === "first_payment")!,
          condition: context.paymentsThisMonth >= 1,
        },
        {
          def: ACHIEVEMENT_DEFINITIONS.find(d => d.key === "ten_payments")!,
          condition: context.paymentsThisMonth >= 10,
        },
        {
          def: ACHIEVEMENT_DEFINITIONS.find(d => d.key === "no_breaks")!,
          condition: context.breaksThisMonth === 0 && context.paymentsThisMonth > 0,
        },
        {
          def: ACHIEVEMENT_DEFINITIONS.find(d => d.key === "goal_reached")!,
          condition: context.isGoalReached,
        },
        {
          def: ACHIEVEMENT_DEFINITIONS.find(d => d.key === "10k_received")!,
          condition: context.totalReceived >= 10000,
        },
        {
          def: ACHIEVEMENT_DEFINITIONS.find(d => d.key === "50k_received")!,
          condition: context.totalReceived >= 50000,
        },
      ];

      for (const { def, condition } of checks) {
        if (!def) continue;
        if (condition && !earnedTitles.includes(def.title)) {
          const granted = await grantAchievement({
            profile_id: profileId,
            tenant_id: tenantId,
            title: def.title,
            description: def.description,
            icon: def.icon,
          });
          if (granted) newlyUnlocked.push(def);
        }
      }

      // Show toast for each new achievement
      for (const achievement of newlyUnlocked) {
        toast.success(`${achievement.icon} Conquista desbloqueada!`, {
          description: achievement.title,
          duration: 5000,
        });
      }

      // Upsert points
      const achievementsCount = earnedTitles.length + newlyUnlocked.length;
      const points = calculatePoints(
        context.paymentsThisMonth,
        context.totalReceived,
        context.breaksThisMonth,
        achievementsCount,
        context.isGoalReached
      );

      await upsertOperatorPoints({
        tenant_id: tenantId,
        operator_id: profileId,
        year,
        month,
        points,
        payments_count: context.paymentsThisMonth,
        breaks_count: context.breaksThisMonth,
        total_received: context.totalReceived,
      });
    } catch (err) {
      console.error("Gamification error:", err);
    }
  }, [profile?.id, tenantUser?.tenant_id]);

  return { checkAndGrantAchievements };
};
