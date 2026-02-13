const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function buildUrl(baseUrl: string, path: string, authParam: string, queryParams?: Record<string, string>) {
  let url = `${baseUrl}/${path}?${authParam}`;
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        url += `&${key}=${encodeURIComponent(value)}`;
      }
    }
  }
  return url;
}

function requireField(body: Record<string, any>, field: string, corsHeaders: Record<string, string>) {
  if (!body[field]) {
    return new Response(
      JSON.stringify({ status: 400, detail: `${field} is required` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

function formatDateParam(dateStr: string | undefined, defaultTime: string): string {
  if (!dateStr) {
    const now = new Date();
    const ymd = now.toISOString().split('T')[0];
    return `${ymd} ${defaultTime}`;
  }
  if (dateStr.includes(' ') || dateStr.includes('T')) return dateStr.replace('T', ' ').split('.')[0];
  return `${dateStr} ${defaultTime}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, domain, api_token } = body;

    if (!domain || !api_token) {
      return new Response(
        JSON.stringify({ status: 400, detail: 'domain and api_token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const baseUrl = `https://${cleanDomain}/api/v1`;
    const authParam = `api_token=${api_token}`;

    let url = '';
    let method = 'GET';
    let reqBody: string | undefined;

    switch (action) {
      // ── Campaigns ──
      case 'list_campaigns':
        url = buildUrl(baseUrl, 'campaigns', authParam);
        break;

      case 'get_campaign_lists': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/lists`, authParam);
        break;
      }

      case 'create_list': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/lists`, authParam);
        method = 'POST';
        reqBody = JSON.stringify({ name: `CollectFlow ${new Date().toLocaleDateString('pt-BR')}` });
        break;
      }

      case 'send_mailing': {
        if (!body.campaign_id || !body.list_id || !body.mailings) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id, list_id and mailings are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/lists/${body.list_id}/mailing`, authParam);
        method = 'POST';
        reqBody = JSON.stringify({
          header: ['identifier', 'areacodephone', 'Nome', 'Extra1', 'Extra2', 'Extra3'],
          mailing: body.mailings,
        });
        break;
      }

      case 'create_campaign': {
        const err = requireField(body, 'campaign_name', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'campaigns', authParam);
        method = 'POST';
        reqBody = JSON.stringify({
          name: body.campaign_name,
          start_time: body.start_time || '08:00',
          end_time: body.end_time || '18:30',
          qualification_list: body.qualification_list_id || null,
        });
        break;
      }

      case 'update_campaign': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}`, authParam);
        method = 'PATCH';
        reqBody = JSON.stringify(body.campaign_data || {});
        break;
      }

      case 'pause_campaign': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/pause`, authParam);
        method = 'PUT';
        break;
      }

      case 'resume_campaign': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/resume`, authParam);
        method = 'PUT';
        break;
      }

      // ── Agents ──
      case 'agents_online':
        url = buildUrl(baseUrl, 'agents/online', authParam);
        break;

      case 'agents_status':
        url = buildUrl(baseUrl, 'agents/status', authParam);
        break;

      case 'logout_agent': {
        const err = requireField(body, 'agent_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `agents/${body.agent_id}/logout`, authParam);
        method = 'POST';
        break;
      }

      // ── Calls ──
      case 'company_calls':
        url = buildUrl(baseUrl, 'company/calls', authParam);
        break;

      case 'campaign_calls': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/calls`, authParam);
        break;
      }

      case 'campaign_agents_status': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/agents/status`, authParam);
        break;
      }

      case 'campaign_statistics': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        const startDate = formatDateParam(body.startDate, '00:00:00');
        const endDate = formatDateParam(body.endDate, '23:59:59');
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/statistics`, authParam, { startDate, endDate });
        break;
      }

      // ── NEW: Recordings ──
      case 'get_recording': {
        const err = requireField(body, 'call_id', corsHeaders);
        if (err) return err;
        const type = body.recording_type || 'recording'; // recording, recording_amd, recording_consult, recording_transfer, recording_after_consult_cancel
        url = buildUrl(baseUrl, `calls/${body.call_id}/${type}`, authParam);
        break;
      }

      // ── NEW: Spy ──
      case 'spy_agent': {
        const err = requireField(body, 'agent_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'spy', authParam);
        method = 'POST';
        reqBody = JSON.stringify({
          agent_id: body.agent_id,
          extension: body.extension || undefined,
          phone_number: body.phone_number || undefined,
        });
        break;
      }

      // ── NEW: Graphic Metrics ──
      case 'campaign_graphic_metrics': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        const startDate = formatDateParam(body.startDate, '00:00:00');
        const endDate = formatDateParam(body.endDate, '23:59:59');
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/metrics/graphic`, authParam, { startDate, endDate });
        break;
      }

      // ── NEW: Calls Report (company) ──
      case 'calls_report': {
        const startDate = formatDateParam(body.startDate, '00:00:00');
        const endDate = formatDateParam(body.endDate, '23:59:59');
        const params: Record<string, string> = { startDate, endDate };
        if (body.campaign_id) params.campaign_id = body.campaign_id;
        if (body.agent_id) params.agent_id = body.agent_id;
        if (body.status) params.status = body.status;
        if (body.page) params.page = body.page;
        url = buildUrl(baseUrl, 'company/calls/report', authParam, params);
        break;
      }

      // ── NEW: Agents Report ──
      case 'agents_report': {
        const startDate = formatDateParam(body.startDate, '00:00:00');
        const endDate = formatDateParam(body.endDate, '23:59:59');
        url = buildUrl(baseUrl, 'company/agents/report', authParam, { startDate, endDate });
        break;
      }

      // ── NEW: Qualifications ──
      case 'list_qualifications':
        url = buildUrl(baseUrl, 'qualifications', authParam);
        break;

      case 'create_qualification': {
        const err = requireField(body, 'qualification_data', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'qualifications', authParam);
        method = 'POST';
        reqBody = JSON.stringify(body.qualification_data);
        break;
      }

      case 'update_qualification': {
        const err = requireField(body, 'qualification_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `qualifications/${body.qualification_id}`, authParam);
        method = 'PUT';
        reqBody = JSON.stringify(body.qualification_data || {});
        break;
      }

      case 'delete_qualification': {
        const err = requireField(body, 'qualification_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `qualifications/${body.qualification_id}`, authParam);
        method = 'DELETE';
        break;
      }

      // ── NEW: Block List ──
      case 'list_block_list':
        url = buildUrl(baseUrl, 'block_lists', authParam);
        break;

      case 'add_block_list': {
        const err = requireField(body, 'phone_number', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'block_lists', authParam);
        method = 'POST';
        reqBody = JSON.stringify({ phone_number: body.phone_number });
        break;
      }

      case 'remove_block_list': {
        const err = requireField(body, 'block_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `block_lists/${body.block_id}`, authParam);
        method = 'DELETE';
        break;
      }

      // ── NEW: Teams ──
      case 'list_teams':
        url = buildUrl(baseUrl, 'teams', authParam);
        break;

      case 'get_team': {
        const err = requireField(body, 'team_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `teams/${body.team_id}`, authParam);
        break;
      }

      case 'create_team': {
        const err = requireField(body, 'team_data', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'teams', authParam);
        method = 'POST';
        reqBody = JSON.stringify(body.team_data);
        break;
      }

      case 'update_team': {
        const err = requireField(body, 'team_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `teams/${body.team_id}`, authParam);
        method = 'PUT';
        reqBody = JSON.stringify(body.team_data || {});
        break;
      }

      // ── NEW: Schedules ──
      case 'list_schedules': {
        const params: Record<string, string> = {};
        if (body.page) params.page = body.page;
        url = buildUrl(baseUrl, 'agent/schedules', authParam, params);
        break;
      }

      // ── NEW: SMS ──
      case 'list_sms_mailings':
        url = buildUrl(baseUrl, 'mailing_list_sms', authParam);
        break;

      case 'create_sms_mailing': {
        const err = requireField(body, 'sms_data', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'mailing_list_sms', authParam);
        method = 'POST';
        reqBody = JSON.stringify(body.sms_data);
        break;
      }

      case 'start_sms_mailing': {
        const err = requireField(body, 'sms_list_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `mailing_list_sms/${body.sms_list_id}/start_list`, authParam);
        method = 'PUT';
        break;
      }

      case 'upload_sms_mailing': {
        const err = requireField(body, 'sms_list_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `mailing_list_sms/${body.sms_list_id}/upload`, authParam);
        method = 'POST';
        reqBody = JSON.stringify(body.upload_data || {});
        break;
      }

      // ── NEW: Users ──
      case 'list_users':
        url = buildUrl(baseUrl, 'users', authParam);
        break;

      case 'create_user': {
        const err = requireField(body, 'user_data', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'users', authParam);
        method = 'POST';
        reqBody = JSON.stringify(body.user_data);
        break;
      }

      case 'update_user': {
        const err = requireField(body, 'user_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `users/${body.user_id}`, authParam);
        method = 'PUT';
        reqBody = JSON.stringify(body.user_data || {});
        break;
      }

      case 'deactivate_user': {
        const err = requireField(body, 'user_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `users/${body.user_id}/deactivate`, authParam);
        break;
      }

      case 'list_active_agents':
        url = buildUrl(baseUrl, 'agents', authParam, { all: 'true', status: 'active' });
        break;

      // ── NEW: Receptive Queues ──
      case 'list_receptive_queues':
        url = buildUrl(baseUrl, 'receptive_queues', authParam);
        break;

      case 'create_receptive_queue': {
        const err = requireField(body, 'queue_data', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'receptive_queues', authParam);
        method = 'POST';
        reqBody = JSON.stringify(body.queue_data);
        break;
      }

      case 'list_receptive_ivr':
        url = buildUrl(baseUrl, 'receptive_ivr', authParam);
        break;

      case 'list_receptive_numbers':
        url = buildUrl(baseUrl, 'receptive_number_setting', authParam);
        break;

      // ── Routes ──
      case 'list_routes':
        url = buildUrl(baseUrl, 'routes', authParam);
        break;

      case 'update_routes': {
        const err = requireField(body, 'routes_data', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'routes', authParam);
        method = 'PUT';
        reqBody = JSON.stringify(body.routes_data);
        break;
      }

      case 'route_hangup_report': {
        const err = requireField(body, 'route_id', corsHeaders);
        if (err) return err;
        const params: Record<string, string> = {};
        if (body.startDate) params.startDate = formatDateParam(body.startDate, '00:00:00');
        if (body.endDate) params.endDate = formatDateParam(body.endDate, '23:59:59');
        url = buildUrl(baseUrl, `routes/${body.route_id}/hangupCauseReport`, authParam, params);
        break;
      }

      // ── Office Hours ──
      case 'list_office_hours':
        url = buildUrl(baseUrl, 'office_hours', authParam);
        break;

      case 'get_office_hours': {
        const err = requireField(body, 'office_hours_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `office_hours/${body.office_hours_id}`, authParam);
        break;
      }

      case 'create_office_hours': {
        const err = requireField(body, 'office_hours_data', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'office_hours', authParam);
        method = 'POST';
        reqBody = JSON.stringify(body.office_hours_data);
        break;
      }

      case 'update_office_hours': {
        const err = requireField(body, 'office_hours_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `office_hours/${body.office_hours_id}`, authParam);
        method = 'PUT';
        reqBody = JSON.stringify(body.office_hours_data || {});
        break;
      }

      case 'delete_office_hours': {
        const err = requireField(body, 'office_hours_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `office_hours/${body.office_hours_id}`, authParam);
        method = 'DELETE';
        break;
      }

      // ── Work Break Intervals ──
      case 'list_work_break_intervals': {
        const err = requireField(body, 'campaign_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `campaigns/${body.campaign_id}/intervals`, authParam);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ status: 400, detail: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`3CPlus proxy: ${action} -> ${method} ${url}`);

    const fetchOptions: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (reqBody) {
      fetchOptions.body = reqBody;
    }

    const response = await fetch(url, fetchOptions);

    // Handle recording endpoints that return audio
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('audio') || action === 'get_recording') {
      if (!response.ok) {
        return new Response(
          JSON.stringify({ status: response.status, detail: 'Recording not available' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Return the audio URL from the redirect or the response URL
      const finalUrl = response.url;
      return new Response(
        JSON.stringify({ status: 200, url: finalUrl }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if response is JSON before parsing
    const respContentType = response.headers.get('content-type') || '';
    if (!respContentType.includes('application/json')) {
      const textBody = await response.text();
      console.error(`3CPlus returned non-JSON (${respContentType}): ${textBody.substring(0, 200)}`);
      return new Response(
        JSON.stringify({ status: response.status, detail: `API returned non-JSON response (status ${response.status}). The endpoint may be unavailable.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`3CPlus response: ${response.status}`);

    // Always return 200 from proxy, include upstream status in response body
    const responseBody = typeof data === 'object' && data !== null
      ? { ...data, status: response.status }
      : { data, status: response.status };

    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('3CPlus proxy error:', error);
    return new Response(
      JSON.stringify({ status: 500, detail: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
