import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { recalculateCampaignScores, type Campaign } from "@/services/campaignService";

/**
 * Module-level dedupe across mounts/tabs in the same session.
 * Maps campaignId -> last recalculation timestamp (ms).
 *
 * Rationale: when the user toggles between Gamificação tabs or remounts the
 * page, we don't want to re-trigger the heavy SQL recalc for every campaign
 * every time. A 60s TTL keeps server load bounded while still feeling "live".
 */
const lastRecalcAt = new Map<string, number>();
const TTL_MS = 60_000;

const scheduleIdle = (cb: () => void) => {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(cb, { timeout: 1500 });
  } else {
    setTimeout(cb, 0);
  }
};

/**
 * Triggers a server-side recalculation of scores for all active campaigns
 * (`recalculate_campaign_scores` RPC) in background. The cron
 * `gamification-recalc-tick` already keeps things fresh every 30 minutes —
 * this hook closes the gap so the UI reflects new payments/agreements as soon
 * as the user opens the Gamificação tab, without waiting for the next tick.
 *
 * - Runs in `requestIdleCallback` to avoid blocking first paint.
 * - Dedupes per campaign via a 60s in-memory TTL.
 * - Invalidates `campaign-participants` queries on success so cards re-render
 *   with the fresh `score` column (Realtime would also catch the change, but
 *   this is faster and works even if Realtime is degraded).
 */
export function useRefreshActiveCampaignScores(activeCampaigns: Campaign[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!activeCampaigns || activeCampaigns.length === 0) return;

    const now = Date.now();
    const due = activeCampaigns.filter((c) => {
      const last = lastRecalcAt.get(c.id) ?? 0;
      return now - last > TTL_MS;
    });
    if (due.length === 0) return;

    // Mark optimistically to prevent re-entrancy from rapid remounts.
    for (const c of due) lastRecalcAt.set(c.id, now);

    let cancelled = false;

    scheduleIdle(async () => {
      const results = await Promise.allSettled(
        due.map((c) => recalculateCampaignScores(c.id)),
      );

      if (cancelled) return;

      const anySuccess = results.some((r) => r.status === "fulfilled");
      if (anySuccess) {
        queryClient.invalidateQueries({ queryKey: ["campaign-participants"] });
      }

      // If every call failed, allow a retry sooner by clearing the TTL marker.
      const allFailed = results.every((r) => r.status === "rejected");
      if (allFailed) {
        for (const c of due) lastRecalcAt.delete(c.id);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Re-run only when the set of active campaign IDs changes.
    activeCampaigns.map((c) => c.id).join("|"),
    queryClient,
  ]);
}
