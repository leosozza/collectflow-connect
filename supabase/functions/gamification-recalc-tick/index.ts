// Cron tick: recalculates gamification snapshot, campaigns, goals and achievements
// for every active operator in every active tenant with the gamification module enabled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const stats = {
    started_at: now.toISOString(),
    tenants_processed: 0,
    operators_processed: 0,
    operators_failed: 0,
    errors: [] as Array<{ tenant_id: string; profile_id: string; message: string }>,
  };

  try {
    // 1) Module id for "gamificacao"
    const { data: moduleRow, error: modErr } = await supabase
      .from("system_modules")
      .select("id")
      .eq("slug", "gamificacao")
      .maybeSingle();

    if (modErr || !moduleRow) {
      throw new Error("Gamificacao module not found");
    }

    // 2) Active tenants with the module enabled
    const { data: tenantModules, error: tmErr } = await supabase
      .from("tenant_modules")
      .select("tenant_id, tenants!inner(id, status, deleted_at)")
      .eq("module_id", moduleRow.id)
      .eq("enabled", true);

    if (tmErr) throw tmErr;

    const activeTenantIds = (tenantModules || [])
      .filter((tm: any) => tm.tenants?.status === "active" && !tm.tenants?.deleted_at)
      .map((tm: any) => tm.tenant_id);

    // 3) For each tenant, list enabled participants and recalc each
    for (const tenantId of activeTenantIds) {
      stats.tenants_processed += 1;

      const { data: participants } = await supabase
        .from("gamification_participants")
        .select("profile_id")
        .eq("tenant_id", tenantId)
        .eq("enabled", true);

      for (const p of (participants || []) as any[]) {
        const { error: rpcErr } = await supabase.rpc("recalculate_operator_full", {
          _profile_id: p.profile_id,
          _year: year,
          _month: month,
        });
        if (rpcErr) {
          stats.operators_failed += 1;
          stats.errors.push({
            tenant_id: tenantId,
            profile_id: p.profile_id,
            message: rpcErr.message,
          });
        } else {
          stats.operators_processed += 1;
        }
      }
    }

    // 4) Audit log (best-effort)
    await supabase.from("audit_logs").insert({
      category: "gamification",
      action: "auto_recalc_tick",
      metadata: stats as any,
    } as any);

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
