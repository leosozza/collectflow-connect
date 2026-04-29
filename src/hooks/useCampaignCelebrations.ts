import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import type { CelebrationPayload } from "@/components/gamificacao/CampaignCelebrationModal";

/**
 * Watches recently auto-closed campaigns for the current operator and
 * surfaces a celebration modal exactly once per (operator, campaign).
 */
export const useCampaignCelebrations = () => {
  const { profile } = useAuth();
  const { tenant, tenantUser, isTenantAdmin } = useTenant();
  const [queue, setQueue] = useState<CelebrationPayload[]>([]);
  const [current, setCurrent] = useState<CelebrationPayload | null>(null);
  const isOperationalParticipant = ["operador", "supervisor", "gerente"].includes(tenantUser?.role || "");

  const loadPending = useCallback(async () => {
    if (isTenantAdmin || !isOperationalParticipant || !profile?.id || !tenant?.id) return;

    // Recently closed campaigns (last 30 days)
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: parts } = await supabase
      .from("campaign_participants")
      .select("campaign_id, score")
      .eq("tenant_id", tenant.id)
      .eq("operator_id", profile.id);

    if (!parts || parts.length === 0) return;
    const campaignIds = parts.map((p: any) => p.campaign_id);

    const { data: campaigns } = await supabase
      .from("gamification_campaigns")
      .select("id, title, prize_description, auto_closed_at, status")
      .in("id", campaignIds)
      .eq("status", "encerrada")
      .not("auto_closed_at", "is", null)
      .gte("auto_closed_at", since.toISOString());

    if (!campaigns || campaigns.length === 0) return;
    const closedIds = campaigns.map((c: any) => c.id);

    const { data: seen } = await supabase
      .from("campaign_celebration_views")
      .select("campaign_id")
      .eq("operator_id", profile.id)
      .in("campaign_id", closedIds);

    const seenSet = new Set((seen || []).map((s: any) => s.campaign_id));
    const pending = campaigns.filter((c: any) => !seenSet.has(c.id));
    if (pending.length === 0) return;

    // Compute position per campaign
    const payloads: CelebrationPayload[] = [];
    for (const c of pending as any[]) {
      const { data: ranking } = await supabase
        .from("campaign_participants")
        .select("operator_id, score")
        .eq("campaign_id", c.id)
        .order("score", { ascending: false });

      const rows = (ranking || []) as Array<{ operator_id: string; score: number }>;
      const idx = rows.findIndex((r) => r.operator_id === profile.id);
      if (idx === -1) continue;
      payloads.push({
        campaign_id: c.id,
        campaign_title: c.title,
        prize_description: c.prize_description,
        position: idx + 1,
        total: rows.length,
        score: Number(rows[idx].score) || 0,
      });
    }

    if (payloads.length > 0) {
      setQueue((prev) => {
        const existing = new Set(prev.map((p) => p.campaign_id));
        const merged = [...prev];
        for (const p of payloads) if (!existing.has(p.campaign_id)) merged.push(p);
        return merged;
      });
    }
  }, [isTenantAdmin, isOperationalParticipant, profile?.id, tenant?.id]);

  useEffect(() => {
    if (isTenantAdmin || !isOperationalParticipant) {
      setCurrent(null);
      setQueue([]);
    }
  }, [isTenantAdmin, isOperationalParticipant]);

  // Initial load + on tenant/profile ready
  useEffect(() => {
    loadPending();
  }, [loadPending]);

  // Realtime: re-check when a campaign auto-closes for this tenant
  useEffect(() => {
    if (isTenantAdmin || !isOperationalParticipant || !tenant?.id) return;
    const channel = supabase
      .channel(`celebration-watch-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gamification_campaigns",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload: any) => {
          if (payload?.new?.status === "encerrada" && payload?.new?.auto_closed_at) {
            loadPending();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isTenantAdmin, isOperationalParticipant, tenant?.id, loadPending]);

  // Promote head of queue to current
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [queue, current]);

  const dismiss = useCallback(async () => {
    const closing = current;
    setCurrent(null);
    setQueue((q) => q.slice(1));
    if (isTenantAdmin || !isOperationalParticipant || !closing || !profile?.id || !tenant?.id) return;
    try {
      await supabase.from("campaign_celebration_views").insert({
        tenant_id: tenant.id,
        campaign_id: closing.campaign_id,
        operator_id: profile.id,
      } as any);
    } catch (err) {
      // unique violation = already seen, ignore
      console.warn("celebration mark seen error:", err);
    }
  }, [current, isTenantAdmin, isOperationalParticipant, profile?.id, tenant?.id]);

  return { current, dismiss, open: !!current };
};
