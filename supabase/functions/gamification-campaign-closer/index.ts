// Closes campaigns whose end_date + end_time (America/Sao_Paulo) has passed.
// Recalculates scores, marks status=encerrada, awards points, and notifies participants.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SP_TZ = "America/Sao_Paulo";

/** Returns Date for the campaign end moment in São Paulo timezone, expressed as UTC instant. */
function campaignEndUtc(endDate: string, endTime: string): Date {
  // endDate: YYYY-MM-DD, endTime: HH:MM[:SS]
  const [hh, mm, ss] = endTime.split(":");
  // Build local-naive ISO string with SP offset.
  // SP is UTC-03:00 year-round (no DST since 2019).
  const iso = `${endDate}T${hh.padStart(2, "0")}:${(mm || "00").padStart(2, "0")}:${(ss || "00").padStart(2, "0")}-03:00`;
  return new Date(iso);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const stats = {
    started_at: new Date().toISOString(),
    campaigns_closed: 0,
    notifications_inserted: 0,
    errors: [] as Array<{ campaign_id: string; message: string }>,
  };

  try {
    // 1. Fetch active campaigns not yet auto-closed
    const { data: campaigns, error: fetchErr } = await supabase
      .from("gamification_campaigns")
      .select("id, tenant_id, title, end_date, end_time, status, auto_closed_at")
      .eq("status", "ativa")
      .is("auto_closed_at", null);

    if (fetchErr) throw fetchErr;

    const now = new Date();

    for (const c of (campaigns || []) as any[]) {
      try {
        if (!c.end_date || !c.end_time) continue;
        const endUtc = campaignEndUtc(c.end_date, c.end_time);
        if (isNaN(endUtc.getTime())) continue;
        if (endUtc.getTime() > now.getTime()) continue; // not due yet

        // 2. Award points (existing RPC) - this also updates participants
        const { error: awardErr } = await supabase.rpc("close_campaign_and_award_points", {
          _campaign_id: c.id,
        });
        if (awardErr) {
          // Log but continue closing so we don't stay stuck
          console.error(`[closer] award error for ${c.id}:`, awardErr.message);
        }

        // 3. Mark closed
        const { error: updErr } = await supabase
          .from("gamification_campaigns")
          .update({
            status: "encerrada",
            auto_closed_at: new Date().toISOString(),
          } as any)
          .eq("id", c.id);
        if (updErr) throw updErr;

        // 4. Read final ranking and notify each participant
        const { data: parts } = await supabase
          .from("campaign_participants")
          .select("operator_id, score")
          .eq("campaign_id", c.id)
          .order("score", { ascending: false });

        const participants = (parts || []) as Array<{ operator_id: string; score: number }>;
        const total = participants.length;

        if (total > 0) {
          // Resolve auth.uid for each profile (notifications.user_id = auth.users.id)
          const profileIds = participants.map((p) => p.operator_id);
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, user_id")
            .in("id", profileIds);
          const userMap = new Map<string, string>(
            (profilesData || []).map((p: any) => [p.id, p.user_id || p.id]),
          );

          const rows = participants.map((p, idx) => {
            const position = idx + 1;
            const userId = userMap.get(p.operator_id) || p.operator_id;
            let title: string;
            let message: string;
            let type = "info";
            if (position === 1) {
              title = `🥇 Você venceu a campanha "${c.title}"!`;
              message = `Parabéns, campeão! Você ficou em 1º lugar com ${Number(p.score).toLocaleString("pt-BR")} pontos.`;
              type = "success";
            } else if (position === 2) {
              title = `🥈 Vice-campeão na "${c.title}"!`;
              message = `Excelente! Você ficou em 2º lugar com ${Number(p.score).toLocaleString("pt-BR")} pontos.`;
              type = "success";
            } else if (position === 3) {
              title = `🥉 Pódio na campanha "${c.title}"!`;
              message = `Muito bem! Você ficou em 3º lugar com ${Number(p.score).toLocaleString("pt-BR")} pontos.`;
              type = "success";
            } else {
              title = `Campanha "${c.title}" encerrada`;
              message = `Você ficou em ${position}º lugar de ${total} participantes. Bora pra próxima!`;
            }
            return {
              tenant_id: c.tenant_id,
              user_id: userId,
              title,
              message,
              type,
              reference_type: "gamification_campaign_closed",
              reference_id: c.id,
            };
          });

          const { error: notifErr } = await supabase.from("notifications").insert(rows as any);
          if (!notifErr) stats.notifications_inserted += rows.length;
          else console.error(`[closer] notif insert error ${c.id}:`, notifErr.message);
        }

        stats.campaigns_closed += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        stats.errors.push({ campaign_id: c.id, message: msg });
        console.error(`[closer] error on campaign ${c.id}:`, msg);
      }
    }

    // Audit log (best-effort)
    if (stats.campaigns_closed > 0 || stats.errors.length > 0) {
      await supabase.from("audit_logs").insert({
        category: "gamification",
        action: "campaign_auto_close_tick",
        metadata: stats as any,
      } as any);
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
