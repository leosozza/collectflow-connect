import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Rate limit: only run if the most recent run is older than 50 minutes,
  // unless explicit secret header bypasses (for manual/admin testing).
  const expectedSecret = Deno.env.get('SHADOW_CHECK_SECRET')
  const providedSecret = req.headers.get('x-shadow-secret')
  const bypassRateLimit = !!expectedSecret && providedSecret === expectedSecret

  if (!bypassRateLimit) {
    const { data: lastRun } = await supabase
      .from('ssot_shadow_checks')
      .select('run_at').order('run_at', { ascending: false }).limit(1).maybeSingle()
    if (lastRun?.run_at) {
      const ageMin = (Date.now() - new Date(lastRun.run_at).getTime()) / 60000
      if (ageMin < 50) {
        return new Response(JSON.stringify({
          skipped: true, reason: 'rate_limited', last_run_minutes_ago: Math.round(ageMin),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }
  }

  const { data: tenants, error: tErr } = await supabase
    .from('tenants').select('id').eq('active', true)
  if (tErr) {
    console.error('[shadow-check] failed to list tenants', tErr)
    return new Response(JSON.stringify({ error: tErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const results: any[] = []
  let totalMismatches = 0
  for (const t of tenants ?? []) {
    const { data, error } = await supabase.rpc('run_ssot_shadow_check', {
      _tenant_id: t.id, _status_sample: 500,
    })
    if (error) {
      console.error(`[shadow-check] tenant ${t.id} failed`, error)
      results.push({ tenant_id: t.id, error: error.message })
      continue
    }
    const summary = data as any
    totalMismatches += summary?.mismatches_found ?? 0
    console.log(`[shadow-check] tenant ${t.id}:`, JSON.stringify(summary?.by_type))
    results.push(summary)
  }

  return new Response(JSON.stringify({
    tenants_processed: results.length, total_mismatches: totalMismatches, results,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
