// Edge Function: dispatch-scheduled-campaigns
// Invoked by pg_cron every minute. Scans for campaigns whose `scheduled_for`
// has arrived and either (a) fires one-shot campaigns directly, or
// (b) clones the mother campaign for recurring runs and reschedules the mother.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TZ = "America/Sao_Paulo";

// ---------- Recurrence helpers ----------

interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly";
  time: string; // "HH:MM"
  weekdays?: number[]; // 0=Sun..6=Sat
  day_of_month?: number; // 1..28
  window_start?: string;
  window_end?: string;
  end_at?: string | null;
  max_runs?: number | null;
  skip_weekends?: boolean;
  timezone?: string;
}

// Compute the next execution datetime (in UTC ISO) after `fromIso` for the rule.
function computeNextRun(rule: RecurrenceRule, fromIso: string): string | null {
  const [hh, mm] = (rule.time || "08:00").split(":").map((x) => parseInt(x, 10));
  const from = new Date(fromIso);

  // We work in local TZ via offsets; for simplicity, treat schedule in UTC-3 (Sao_Paulo, no DST)
  // Using explicit -03:00 offset; this is acceptable for Brazil post-2019.
  const TZ_OFFSET_MIN = -180; // UTC-3

  // Convert `from` to TZ-local components
  const localFromMs = from.getTime() + TZ_OFFSET_MIN * 60000;
  const localFrom = new Date(localFromMs);

  let candidate = new Date(localFromMs);
  candidate.setUTCHours(hh, mm, 0, 0);
  if (candidate <= localFrom) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  const maxIter = 370;
  for (let i = 0; i < maxIter; i++) {
    const day = candidate.getUTCDay(); // 0..6
    const skipWeekends = rule.skip_weekends && (day === 0 || day === 6);

    let matches = false;
    if (!skipWeekends) {
      if (rule.frequency === "daily") {
        matches = true;
      } else if (rule.frequency === "weekly") {
        const wds = rule.weekdays && rule.weekdays.length > 0 ? rule.weekdays : [1, 2, 3, 4, 5];
        matches = wds.includes(day);
      } else if (rule.frequency === "monthly") {
        // Allow 1-31; when month has fewer days, fire on the last day available.
        const requested = Math.min(Math.max(rule.day_of_month || 1, 1), 31);
        const year = candidate.getUTCFullYear();
        const month = candidate.getUTCMonth(); // 0..11
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const dom = Math.min(requested, daysInMonth);
        matches = candidate.getUTCDate() === dom;
      }
    }

    if (matches) {
      // Convert local candidate back to UTC
      const utcMs = candidate.getTime() - TZ_OFFSET_MIN * 60000;
      const nextUtc = new Date(utcMs);

      // Honor end_at
      if (rule.end_at && nextUtc > new Date(rule.end_at)) return null;
      return nextUtc.toISOString();
    }

    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return null;
}

// ---------- Dispatcher ----------

async function dispatchOneShot(supabase: any, campaign: any) {
  // Atomic status flip
  const { data: updated, error } = await supabase
    .from("whatsapp_campaigns")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("id", campaign.id)
    .eq("status", "scheduled")
    .select()
    .single();

  if (error || !updated) {
    console.log(`[one-shot] skipped ${campaign.id}: ${error?.message || "race"}`);
    return;
  }

  // Audit log (never blocks dispatch if it fails — e.g. null created_by)
  try {
    if (campaign.created_by) {
      await supabase.from("audit_logs").insert({
        tenant_id: campaign.tenant_id,
        user_id: campaign.created_by,
        user_name: "system",
        action: "scheduled_campaign_triggered",
        entity_type: "whatsapp_campaign",
        entity_id: campaign.id,
        details: { scheduled_for: campaign.scheduled_for },
      });
    }
  } catch (e: any) {
    console.log(`[one-shot] audit_log insert failed (non-fatal): ${e?.message}`);
  }

  // Invoke send-bulk-whatsapp (fire-and-forget)
  fetch(`${SUPABASE_URL}/functions/v1/send-bulk-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ campaign_id: campaign.id }),
  }).catch((e) => console.log(`[one-shot] invoke failed ${campaign.id}:`, e?.message));

  console.log(`[one-shot] dispatched ${campaign.id}`);
}

async function dispatchRecurring(supabase: any, mother: any) {
  const rule = mother.recurrence_rule as RecurrenceRule;
  const now = new Date();

  // Atomic lock: flip scheduled_for to null to prevent concurrent cron runs from re-processing this row.
  // If 0 rows affected, another invocation already grabbed it — bail out.
  const { data: locked, error: lockErr } = await supabase
    .from("whatsapp_campaigns")
    .update({ scheduled_for: null })
    .eq("id", mother.id)
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .select()
    .maybeSingle();

  if (lockErr || !locked) {
    console.log(`[recurring] lost race for ${mother.id}: ${lockErr?.message || "already claimed"}`);
    return;
  }
  // Merge the locked snapshot with the original `mother` payload from the initial SELECT *.
  // PostgREST `.update().select()` returns the full row, but we defensively preserve
  // any field already present on the pre-lock snapshot to avoid subtle regressions.
  mother = { ...mother, ...locked };
  console.log(`[recurring] locked ${mother.id} routing_mode=${mother.routing_mode} weights=${JSON.stringify(mother.instance_weights)}`);

  // Check max_runs
  if (rule.max_runs != null && (mother.recurrence_run_count || 0) >= rule.max_runs) {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "completed", scheduled_for: null })
      .eq("id", mother.id);
    try {
      if (mother.created_by) {
        await supabase.from("audit_logs").insert({
          tenant_id: mother.tenant_id,
          user_id: mother.created_by,
          user_name: "system",
          action: "recurring_campaign_finished",
          entity_type: "whatsapp_campaign",
          entity_id: mother.id,
          details: { reason: "max_runs_reached", runs: mother.recurrence_run_count },
        });
      }
    } catch (e: any) {
      console.log(`[recurring] audit insert failed (non-fatal): ${e?.message}`);
    }
    return;
  }

  // Check end_at
  if (rule.end_at && now > new Date(rule.end_at)) {
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "completed", scheduled_for: null })
      .eq("id", mother.id);
    try {
      if (mother.created_by) {
        await supabase.from("audit_logs").insert({
          tenant_id: mother.tenant_id,
          user_id: mother.created_by,
          user_name: "system",
          action: "recurring_campaign_finished",
          entity_type: "whatsapp_campaign",
          entity_id: mother.id,
          details: { reason: "end_at_passed" },
        });
      }
    } catch (e: any) {
      console.log(`[recurring] audit insert failed (non-fatal): ${e?.message}`);
    }
    return;
  }

  // Window check — lexicographic comparison of "HH:MM" strings works because
  // the editor always produces 2-digit zero-padded values. Inclusive on both ends.
  if (rule.window_start && rule.window_end) {
    const localNowMs = now.getTime() + -180 * 60000;
    const local = new Date(localNowMs);
    const hhmm = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
    if (hhmm < rule.window_start || hhmm > rule.window_end) {
      console.log(`[recurring] ${mother.id} out of window (${hhmm}), skipping and advancing`);
      const next = computeNextRun(rule, now.toISOString());
      await supabase
        .from("whatsapp_campaigns")
        .update({ scheduled_for: next, status: next ? "scheduled" : "completed" })
        .eq("id", mother.id);
      return;
    }
  }

  // Clone recipients from mother
  const { data: motherRecipients } = await supabase
    .from("whatsapp_campaign_recipients")
    .select(
      "representative_client_id, phone, recipient_name, assigned_instance_id, message_body_snapshot"
    )
    .eq("campaign_id", mother.id);

  if (!motherRecipients || motherRecipients.length === 0) {
    console.log(`[recurring] ${mother.id} has no recipients, marking completed`);
    await supabase
      .from("whatsapp_campaigns")
      .update({ status: "completed", scheduled_for: null })
      .eq("id", mother.id);
    return;
  }

  // Create child campaign
  const { data: child, error: childErr } = await supabase
    .from("whatsapp_campaigns")
    .insert({
      tenant_id: mother.tenant_id,
      source: mother.source,
      channel_type: mother.channel_type,
      provider_category: mother.provider_category,
      campaign_type: mother.campaign_type,
      status: "sending",
      message_mode: mother.message_mode,
      message_body: mother.message_body,
      template_id: mother.template_id,
      selected_instance_ids: mother.selected_instance_ids,
      total_selected: mother.total_selected,
      total_unique_recipients: motherRecipients.length,
      created_by: mother.created_by,
      name: `${mother.name || "Recorrente"} — ${new Date().toLocaleString("pt-BR", { timeZone: TZ })}`,
      origin_type: mother.origin_type,
      routing_mode: mother.routing_mode,
      instance_weights: mother.instance_weights,
      parent_campaign_id: mother.id,
      schedule_type: "once",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (childErr || !child) {
    console.error(`[recurring] failed to create child for ${mother.id}:`, childErr?.message);
    try {
      await supabase.from("whatsapp_campaign_runs").insert({
        tenant_id: mother.tenant_id,
        parent_campaign_id: mother.id,
        run_at: new Date().toISOString(),
        status: "failed",
        recipients_count: motherRecipients.length,
        error_message: childErr?.message || "child creation failed",
      });
    } catch (e: any) {
      console.log(`[recurring] run insert failed (non-fatal): ${e?.message}`);
    }
    return;
  }

  // Copy recipients to child
  const childRows = motherRecipients.map((r: any) => ({
    campaign_id: child.id,
    tenant_id: mother.tenant_id,
    representative_client_id: r.representative_client_id,
    phone: r.phone,
    recipient_name: r.recipient_name,
    assigned_instance_id: r.assigned_instance_id,
    message_body_snapshot: r.message_body_snapshot,
    status: "pending",
  }));

  for (let i = 0; i < childRows.length; i += 500) {
    await supabase
      .from("whatsapp_campaign_recipients")
      .insert(childRows.slice(i, i + 500));
  }

  // Log the run (non-blocking)
  try {
    await supabase.from("whatsapp_campaign_runs").insert({
      tenant_id: mother.tenant_id,
      parent_campaign_id: mother.id,
      child_campaign_id: child.id,
      run_at: new Date().toISOString(),
      status: "triggered",
      recipients_count: motherRecipients.length,
    });
  } catch (e: any) {
    console.log(`[recurring] run insert failed (non-fatal): ${e?.message}`);
  }

  // Audit (non-blocking)
  try {
    if (mother.created_by) {
      await supabase.from("audit_logs").insert({
        tenant_id: mother.tenant_id,
        user_id: mother.created_by,
        user_name: "system",
        action: "recurring_run_executed",
        entity_type: "whatsapp_campaign",
        entity_id: mother.id,
        details: { child_campaign_id: child.id, run_count: (mother.recurrence_run_count || 0) + 1 },
      });
    }
  } catch (e: any) {
    console.log(`[recurring] audit insert failed (non-fatal): ${e?.message}`);
  }

  // Compute next run and update mother
  const next = computeNextRun(rule, new Date(now.getTime() + 60000).toISOString());
  const newRunCount = (mother.recurrence_run_count || 0) + 1;
  const reachedMax = rule.max_runs != null && newRunCount >= rule.max_runs;
  const reachedEnd = !next;

  await supabase
    .from("whatsapp_campaigns")
    .update({
      scheduled_for: reachedMax || reachedEnd ? null : next,
      status: reachedMax || reachedEnd ? "completed" : "scheduled",
      recurrence_run_count: newRunCount,
    })
    .eq("id", mother.id);

  // Fire-and-forget dispatcher for child
  fetch(`${SUPABASE_URL}/functions/v1/send-bulk-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ campaign_id: child.id }),
  }).catch((e) => console.log(`[recurring] invoke failed ${child.id}:`, e?.message));

  console.log(`[recurring] mother=${mother.id} child=${child.id} next=${next}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const now = new Date().toISOString();
    const { data: due, error } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", now)
      .limit(50);

    if (error) throw error;

    let processed = 0;
    for (const campaign of (due || []) as any[]) {
      try {
        if (campaign.schedule_type === "recurring") {
          await dispatchRecurring(supabase, campaign);
        } else {
          await dispatchOneShot(supabase, campaign);
        }
        processed++;
      } catch (e: any) {
        console.error(`[dispatcher] error on ${campaign.id}:`, e?.message);
      }
    }

    // ---------- Auto-heal: free orphan recipients & stale locks ----------
    // Workers that died mid-chunk leave recipients in `processing` and a fresh
    // `processing_locked_at` on the campaign. We free both so the watchdog
    // below can re-invoke and the next worker actually finds work to do.
    const orphanRecipientCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const staleLockCutoff10m = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: sendingCampaigns } = await supabase
      .from("whatsapp_campaigns")
      .select("id")
      .eq("status", "sending");

    const sendingIds = (sendingCampaigns || []).map((c: any) => c.id);
    if (sendingIds.length > 0) {
      const { error: orphanErr, count: orphanCount } = await supabase
        .from("whatsapp_campaign_recipients")
        .update({ status: "pending", updated_at: new Date().toISOString() }, { count: "exact" })
        .in("campaign_id", sendingIds)
        .eq("status", "processing")
        .lt("updated_at", orphanRecipientCutoff);
      if (orphanErr) console.error("[dispatcher] auto-heal orphan recipients failed:", orphanErr.message);
      else if ((orphanCount || 0) > 0) console.log(`[dispatcher] auto-heal: freed ${orphanCount} orphan recipients`);

      const { error: lockErr, count: lockCount } = await supabase
        .from("whatsapp_campaigns")
        .update({ processing_locked_at: null, processing_locked_by: null }, { count: "exact" })
        .eq("status", "sending")
        .lt("processing_locked_at", staleLockCutoff10m);
      if (lockErr) console.error("[dispatcher] auto-heal stale locks failed:", lockErr.message);
      else if ((lockCount || 0) > 0) console.log(`[dispatcher] auto-heal: cleared ${lockCount} stale campaign locks`);
    }

    // ---------- Watchdog: re-invoke orphaned `sending` campaigns ----------
    // A campaign is orphaned when it's still in `sending` but no worker is
    // actively processing it (lock null OR stale > 2min) and there are still
    // pending/processing recipients. Hits when a previous worker timed out
    // (380s edge-runtime cap) without self-retriggering.
    // Reduced from 2min → 45s so watchdog re-invokes orphan campaigns faster.
    // Combined with worker self-retrigger this keeps the gap between cycles < 1min.
    const staleCutoff = new Date(Date.now() - 45 * 1000).toISOString();
    const { data: stalled } = await supabase
      .from("whatsapp_campaigns")
      .select("id, processing_locked_at")
      .eq("status", "sending")
      .or(`processing_locked_at.is.null,processing_locked_at.lt.${staleCutoff}`)
      .limit(20);

    let watchdogReinvoked = 0;
    for (const c of (stalled || []) as any[]) {
      // Confirm there are pending recipients before invoking
      const { count } = await supabase
        .from("whatsapp_campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .in("status", ["pending", "processing"]);

      if ((count || 0) === 0) continue;

      console.log(`[dispatcher] watchdog re-invoking ${c.id} (pending=${count}, lock=${c.processing_locked_at || "null"})`);
      fetch(`${SUPABASE_URL}/functions/v1/send-bulk-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ campaign_id: c.id }),
      }).catch((e) => console.log(`[watchdog] invoke failed ${c.id}:`, e?.message));
      watchdogReinvoked++;
    }

    return new Response(
      JSON.stringify({ ok: true, processed, scanned: (due || []).length, watchdogReinvoked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[dispatcher] fatal:", e?.message);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
