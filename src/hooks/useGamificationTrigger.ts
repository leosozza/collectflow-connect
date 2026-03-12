import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useGamification } from "@/hooks/useGamification";
import { fetchMyGoal } from "@/services/goalService";

export const useGamificationTrigger = () => {
  const { user, profile } = useAuth();
  const { tenantUser } = useTenant();
  const { checkAndGrantAchievements } = useGamification();

  const triggerGamificationUpdate = useCallback(async () => {
    if (!profile?.id || !user?.id || !tenantUser?.tenant_id) return;

    const authUid = user.id; // auth.uid() — used in agreements.created_by
    const profileId = profile.id; // profiles.id — used in clients.operator_id

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    try {
      // Payments this month (clients.operator_id = profile.id)
      const { count: paymentsCount } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("operator_id", profileId)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);

      // Total received this month
      const { data: receivedData } = await supabase
        .from("clients")
        .select("valor_pago")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("operator_id", profileId)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);

      const totalReceived = (receivedData || []).reduce((sum, c) => sum + (c.valor_pago || 0), 0);

      // Agreements count this month (agreements.created_by = auth.uid())
      const { count: agreementsCount } = await supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("created_by", authUid)
        .neq("status", "rejected")
        .neq("status", "cancelled")
        .gte("created_at", monthStart)
        .lt("created_at", nextMonth);

      // Breaks this month (agreements.created_by = auth.uid())
      const { count: breaksCount } = await supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("created_by", authUid)
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

      // Update campaign scores for active campaigns
      await updateCampaignScores({
        tenantId: tenantUser.tenant_id,
        profileId,
        authUid,
        totalReceived,
        agreementsCount: agreementsCount || 0,
        breaksCount: breaksCount || 0,
        paymentsCount: paymentsCount || 0,
        monthStart,
        nextMonth,
      });
    } catch (err) {
      console.error("Gamification trigger error:", err);
    }
  }, [user?.id, profile?.id, tenantUser?.tenant_id, checkAndGrantAchievements]);

  return { triggerGamificationUpdate };
};

async function updateCampaignScores(params: {
  tenantId: string;
  profileId: string;
  authUid: string;
  totalReceived: number;
  agreementsCount: number;
  breaksCount: number;
  paymentsCount: number;
  monthStart: string;
  nextMonth: string;
}) {
  const { tenantId, profileId, totalReceived, agreementsCount, breaksCount } = params;

  // Find active campaigns where this operator participates
  const { data: participations } = await supabase
    .from("campaign_participants")
    .select("id, campaign_id, operator_id")
    .eq("tenant_id", tenantId)
    .eq("operator_id", profileId);

  if (!participations || participations.length === 0) return;

  const campaignIds = [...new Set(participations.map((p: any) => p.campaign_id))];
  const { data: campaigns } = await supabase
    .from("gamification_campaigns")
    .select("id, metric, status")
    .in("id", campaignIds)
    .eq("status", "active");

  if (!campaigns || campaigns.length === 0) return;

  for (const campaign of campaigns) {
    let score = 0;
    switch (campaign.metric) {
      case "maior_valor_recebido":
        score = totalReceived;
        break;
      case "maior_qtd_acordos":
        score = agreementsCount;
        break;
      case "menor_taxa_quebra":
        // Lower is better, store inverse so higher = better in ranking
        score = agreementsCount > 0 ? Math.max(0, 100 - (breaksCount / agreementsCount) * 100) : 0;
        break;
      case "menor_valor_quebra":
        // For "menor valor quebra", we store negative so sorting desc works
        // Actually store raw break value; UI should sort ascending
        score = -(breaksCount); // simplified — actual value would need querying break amounts
        break;
      case "maior_valor_promessas":
        score = totalReceived; // approximation
        break;
      default:
        score = totalReceived;
    }

    await supabase
      .from("campaign_participants")
      .update({ score, updated_at: new Date().toISOString() } as any)
      .eq("campaign_id", campaign.id)
      .eq("operator_id", profileId);
  }
}
