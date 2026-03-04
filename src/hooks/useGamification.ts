import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  calculatePoints,
  grantAchievement,
  fetchMyAchievements,
  upsertOperatorPoints,
} from "@/services/gamificationService";
import { creditRivoCoins } from "@/services/rivocoinService";

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
      // Fetch achievement templates from DB
      const { data: templates } = await supabase
        .from("achievement_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (!templates || templates.length === 0) {
        // No templates configured, just update points
        const earnedTitles = await fetchMyAchievements(profileId);
        const points = calculatePoints(
          context.paymentsThisMonth,
          context.totalReceived,
          context.breaksThisMonth,
          earnedTitles.length,
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
        return;
      }

      const earnedTitles = await fetchMyAchievements(profileId);
      const newlyUnlocked: Array<{ title: string; description: string; icon: string; points_reward: number }> = [];

      for (const template of templates) {
        if (earnedTitles.includes(template.title)) continue;

        let condition = false;
        const value = template.criteria_value;

        switch (template.criteria_type) {
          case "payments_count":
            condition = context.paymentsThisMonth >= value;
            break;
          case "total_received":
            condition = context.totalReceived >= value;
            break;
          case "zero_breaks":
            condition = context.breaksThisMonth === 0 && context.paymentsThisMonth > 0;
            break;
          case "goal_reached":
            condition = context.isGoalReached;
            break;
          case "agreements_count":
            condition = context.paymentsThisMonth >= value;
            break;
          default:
            break;
        }

        if (condition) {
          const granted = await grantAchievement({
            profile_id: profileId,
            tenant_id: tenantId,
            title: template.title,
            description: template.description,
            icon: template.icon,
          });
          if (granted) {
            newlyUnlocked.push({
              title: template.title,
              description: template.description,
              icon: template.icon,
              points_reward: template.points_reward || 0,
            });
          }
        }
      }

      // Credit RivoCoins for new achievements
      for (const achievement of newlyUnlocked) {
        toast.success(`${achievement.icon} Conquista desbloqueada!`, {
          description: achievement.title,
          duration: 5000,
        });

        if (achievement.points_reward > 0) {
          await creditRivoCoins({
            tenant_id: tenantId,
            profile_id: profileId,
            amount: achievement.points_reward,
            description: `Conquista: ${achievement.title}`,
            reference_type: "achievement",
          });
        }
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
