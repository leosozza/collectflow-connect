import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  grantAchievement,
  fetchMyAchievements,
} from "@/services/gamificationService";


interface AchievementContext {
  paymentsThisMonth: number;
  agreementsThisMonth: number;
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

    try {
      // Fetch achievement templates from DB
      const { data: templates } = await supabase
        .from("achievement_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (!templates || templates.length === 0) return;

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
          case "no_breaks":
          case "zero_breaks":
            condition = context.breaksThisMonth === 0 && context.paymentsThisMonth > 0;
            break;
          case "goal_reached":
            condition = context.isGoalReached;
            break;
          case "agreements_count":
            condition = context.agreementsThisMonth >= value;
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

      // Notify user + credit Pontos no mês corrente (serão convertidos em Rivo Coins na virada do mês)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      for (const achievement of newlyUnlocked) {
        toast.success(`${achievement.icon} Conquista desbloqueada!`, {
          description: `${achievement.title}${achievement.points_reward > 0 ? ` — +${achievement.points_reward} pontos` : ""}`,
          duration: 5000,
        });

        if (achievement.points_reward > 0) {
          await supabase.rpc("add_operator_bonus_points", {
            _tenant_id: tenantId,
            _operator_id: profileId,
            _year: currentYear,
            _month: currentMonth,
            _amount: achievement.points_reward,
          });
        }
      }
    } catch (err) {
      console.error("Gamification achievements error:", err);
    }
  }, [profile?.id, tenantUser?.tenant_id]);

  return { checkAndGrantAchievements };
};
