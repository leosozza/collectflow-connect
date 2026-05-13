import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const expectedSecret = Deno.env.get('SHADOW_CHECK_SECRET')
  const providedSecret = req.headers.get('x-shadow-secret')
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

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
