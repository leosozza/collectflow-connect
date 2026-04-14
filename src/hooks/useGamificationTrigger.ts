import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useGamification } from "@/hooks/useGamification";
import { fetchMyGoal } from "@/services/goalService";
import { calculatePoints, upsertOperatorPoints } from "@/services/gamificationService";

export const useGamificationTrigger = () => {
  const { user, profile } = useAuth();
  const { tenantUser } = useTenant();
  const { checkAndGrantAchievements } = useGamification();

  const triggerGamificationUpdate = useCallback(async () => {
    if (!profile?.id || !user?.id || !tenantUser?.tenant_id) return;

    const authUid = user.id;
    const profileId = profile.id;
    const tenantId = tenantUser.tenant_id;

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
        .eq("tenant_id", tenantId)
        .eq("operator_id", profileId)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);

      // Total received this month
      const { data: receivedData } = await supabase
        .from("clients")
        .select("valor_pago")
        .eq("tenant_id", tenantId)
        .eq("operator_id", profileId)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);

      const totalReceived = (receivedData || []).reduce((sum, c) => sum + (c.valor_pago || 0), 0);

      // Agreements count this month (agreements.created_by = auth.uid())
      const { count: agreementsCount } = await supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("created_by", authUid)
        .neq("status", "rejected")
        .neq("status", "cancelled")
        .gte("created_at", monthStart)
        .lt("created_at", nextMonth);

      // Breaks this month (agreements.created_by = auth.uid())
      const { count: breaksCount } = await supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("created_by", authUid)
        .eq("status", "cancelled")
        .gte("updated_at", monthStart)
        .lt("updated_at", nextMonth);

      // Check if goal reached
      const goal = await fetchMyGoal(year, month);
      const isGoalReached = goal ? totalReceived >= goal.target_amount : false;

      // Achievements
      const { data: achievementsData } = await supabase
        .from("achievements")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId);
      const achievementsCount = achievementsData?.length || 0;

      await checkAndGrantAchievements({
        paymentsThisMonth: paymentsCount || 0,
        totalReceived,
        breaksThisMonth: breaksCount || 0,
        isGoalReached,
      });

      // Calculate and persist operator points
      const points = calculatePoints(
        paymentsCount || 0,
        totalReceived,
        breaksCount || 0,
        achievementsCount,
        isGoalReached
      );

      await upsertOperatorPoints({
        tenant_id: tenantId,
        operator_id: profileId,
        year,
        month,
        points,
        payments_count: paymentsCount || 0,
        breaks_count: breaksCount || 0,
        total_received: totalReceived,
      });

      // Update campaign scores for active campaigns
      await updateCampaignScores({
        tenantId,
        profileId,
        authUid,
        monthStart,
        nextMonth,
      });
    } catch (err) {
      console.error("Gamification trigger error:", err);
    }
  }, [user?.id, profile?.id, tenantUser?.tenant_id, checkAndGrantAchievements]);

  return { triggerGamificationUpdate };
};

/**
 * Resolve razao_social names for creditors linked to a campaign.
 * Returns null if no creditors are linked (meaning "all creditors").
 */
async function getCampaignCredorNames(campaignId: string, tenantId: string): Promise<string[] | null> {
  const { data: campaignCredores } = await supabase
    .from("campaign_credores")
    .select("credor_id")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId);

  if (!campaignCredores || campaignCredores.length === 0) return null;

  const credorIds = campaignCredores.map((cc: any) => cc.credor_id);
  const { data: credores } = await supabase
    .from("credores")
    .select("razao_social")
    .in("id", credorIds);

  if (!credores || credores.length === 0) return null;
  return credores.map((c: any) => c.razao_social);
}

async function updateCampaignScores(params: {
  tenantId: string;
  profileId: string;
  authUid: string;
  monthStart: string;
  nextMonth: string;
}) {
  const { tenantId, profileId, authUid, monthStart, nextMonth } = params;

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
    const credorNames = await getCampaignCredorNames(campaign.id, tenantId);
    const score = await calculateCampaignScore({
      metric: campaign.metric,
      tenantId,
      profileId,
      authUid,
      monthStart,
      nextMonth,
      credorNames,
    });

    await supabase
      .from("campaign_participants")
      .update({ score, updated_at: new Date().toISOString() } as any)
      .eq("campaign_id", campaign.id)
      .eq("operator_id", profileId);
  }
}

async function calculateCampaignScore(params: {
  metric: string;
  tenantId: string;
  profileId: string;
  authUid: string;
  monthStart: string;
  nextMonth: string;
  credorNames: string[] | null;
}): Promise<number> {
  const { metric, tenantId, profileId, authUid, monthStart, nextMonth, credorNames } = params;

  switch (metric) {
    case "maior_valor_recebido": {
      let query = supabase
        .from("clients")
        .select("valor_pago")
        .eq("tenant_id", tenantId)
        .eq("operator_id", profileId)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);
      if (credorNames) query = query.in("credor", credorNames);
      const { data } = await query;
      return (data || []).reduce((sum, c) => sum + (c.valor_pago || 0), 0);
    }

    case "maior_qtd_acordos": {
      let query = supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("created_by", authUid)
        .neq("status", "rejected")
        .neq("status", "cancelled")
        .gte("created_at", monthStart)
        .lt("created_at", nextMonth);
      if (credorNames) query = query.in("credor", credorNames);
      const { count } = await query;
      return count || 0;
    }

    case "menor_taxa_quebra": {
      // Total agreements
      let totalQuery = supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("created_by", authUid)
        .gte("created_at", monthStart)
        .lt("created_at", nextMonth);
      if (credorNames) totalQuery = totalQuery.in("credor", credorNames);
      const { count: totalCount } = await totalQuery;

      if (!totalCount || totalCount === 0) return 100; // No agreements = perfect performance

      // Cancelled agreements
      let breakQuery = supabase
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("created_by", authUid)
        .eq("status", "cancelled")
        .gte("updated_at", monthStart)
        .lt("updated_at", nextMonth);
      if (credorNames) breakQuery = breakQuery.in("credor", credorNames);
      const { count: breakCount } = await breakQuery;

      return Math.max(0, 100 - ((breakCount || 0) / totalCount) * 100);
    }

    case "menor_valor_quebra": {
      // Sum of proposed_total from cancelled agreements
      let query = supabase
        .from("agreements")
        .select("proposed_total")
        .eq("tenant_id", tenantId)
        .eq("created_by", authUid)
        .eq("status", "cancelled")
        .gte("updated_at", monthStart)
        .lt("updated_at", nextMonth);
      if (credorNames) query = query.in("credor", credorNames);
      const { data } = await query;
      const breakValue = (data || []).reduce((sum, a) => sum + (a.proposed_total || 0), 0);
      // Lower break value = better, so invert for ranking (higher score = better)
      // Use a large base minus the break value
      return Math.max(0, 1000000 - breakValue);
    }

    case "maior_valor_promessas": {
      // Sum of proposed_total from pending/approved agreements
      let query = supabase
        .from("agreements")
        .select("proposed_total")
        .eq("tenant_id", tenantId)
        .eq("created_by", authUid)
        .in("status", ["pending", "approved"])
        .gte("created_at", monthStart)
        .lt("created_at", nextMonth);
      if (credorNames) query = query.in("credor", credorNames);
      const { data } = await query;
      return (data || []).reduce((sum, a) => sum + (a.proposed_total || 0), 0);
    }

    default: {
      // Fallback: total received
      let query = supabase
        .from("clients")
        .select("valor_pago")
        .eq("tenant_id", tenantId)
        .eq("operator_id", profileId)
        .gte("data_quitacao", monthStart)
        .lt("data_quitacao", nextMonth);
      if (credorNames) query = query.in("credor", credorNames);
      const { data } = await query;
      return (data || []).reduce((sum, c) => sum + (c.valor_pago || 0), 0);
    }
  }
}
