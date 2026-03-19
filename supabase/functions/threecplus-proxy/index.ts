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

async function resolveAgentToken(baseUrl: string, authParam: string, agentId: number | string): Promise<any | null> {
  const url = buildUrl(baseUrl, 'users', authParam, { per_page: '500' });
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    console.error(`resolveAgentToken: GET /users failed with status ${res.status}`);
    return null;
  }
  const raw = await res.json();
  // Support paginated { data: { data: [...] } }, flat { data: [...] }, or raw [...]
  const list = (raw?.data?.data && Array.isArray(raw.data.data))
    ? raw.data.data
    : Array.isArray(raw?.data) ? raw.data
    : Array.isArray(raw) ? raw : [];
  const numId = Number(agentId);
  const agent = list.find((u: any) => u.id === numId || Number(u.id) === numId) || null;
  if (agent) {
    console.log(`resolveAgentToken: Found agent ${agentId} (api_token present: ${!!agent.api_token}, extension: ${agent.extension || 'none'})`);
  } else {
    console.error(`resolveAgentToken: Agent ${agentId} NOT found in ${list.length} users`);
  }
  return agent;
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
          header: ['identifier', 'phone', 'Nome', 'Extra1', 'Extra2', 'Extra3'],
          mailing: body.mailings,
        });
        break;
      }

      case 'create_campaign': {
        const err = requireField(body, 'campaign_name', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'campaigns', authParam);
        method = 'POST';
        const campaignPayload: Record<string, any> = {
          name: body.campaign_name,
          start_time: body.start_time || '08:00',
          end_time: body.end_time || '18:30',
        };
        if (body.qualification_list_id) campaignPayload.qualification_list = body.qualification_list_id;
        if (body.work_break_group_id) campaignPayload.work_break_group_id = body.work_break_group_id;
        reqBody = JSON.stringify(campaignPayload);
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

      // ── Qualification Lists (global) ──
      case 'list_qualification_lists':
        url = buildUrl(baseUrl, 'qualification_lists', authParam);
        break;

      case 'create_qualification_list': {
        const err = requireField(body, 'name', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'qualification_lists', authParam);
        method = 'POST';
        reqBody = JSON.stringify({ name: body.name });
        break;
      }

      case 'update_qualification_list': {
        const err = requireField(body, 'list_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `qualification_lists/${body.list_id}`, authParam);
        method = 'PUT';
        reqBody = JSON.stringify({ name: body.name });
        break;
      }

      case 'delete_qualification_list': {
        const err = requireField(body, 'list_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `qualification_lists/${body.list_id}`, authParam);
        method = 'DELETE';
        break;
      }

      // ── Qualifications inside a list ──
      case 'list_qualification_list_items': {
        const err = requireField(body, 'list_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `qualification_lists/${body.list_id}/qualifications`, authParam);
        break;
      }

      case 'create_qualification_list_item': {
        const err = requireField(body, 'list_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `qualification_lists/${body.list_id}/qualifications`, authParam);
        method = 'POST';
        reqBody = JSON.stringify({ name: body.name, ...(body.item_data || {}) });
        break;
      }

      case 'update_qualification_list_item': {
        const err1 = requireField(body, 'list_id', corsHeaders);
        if (err1) return err1;
        const err2 = requireField(body, 'item_id', corsHeaders);
        if (err2) return err2;
        url = buildUrl(baseUrl, `qualification_lists/${body.list_id}/qualifications/${body.item_id}`, authParam);
        method = 'PUT';
        reqBody = JSON.stringify({ name: body.name, ...(body.item_data || {}) });
        break;
      }

      case 'delete_qualification_list_item': {
        const err1 = requireField(body, 'list_id', corsHeaders);
        if (err1) return err1;
        const err2 = requireField(body, 'item_id', corsHeaders);
        if (err2) return err2;
        url = buildUrl(baseUrl, `qualification_lists/${body.list_id}/qualifications/${body.item_id}`, authParam);
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

      // ── Work Break Groups (global) ──
      case 'list_work_break_groups':
        url = buildUrl(baseUrl, 'work_break_group', authParam);
        break;

      case 'create_work_break_group': {
        const err = requireField(body, 'name', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'work_break_group', authParam);
        method = 'POST';
        reqBody = JSON.stringify({ name: body.name });
        break;
      }

      case 'update_work_break_group': {
        const err = requireField(body, 'group_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `work_break_group/${body.group_id}`, authParam);
        method = 'PUT';
        reqBody = JSON.stringify({ name: body.name });
        break;
      }

      case 'delete_work_break_group': {
        const err = requireField(body, 'group_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `work_break_group/${body.group_id}`, authParam);
        method = 'DELETE';
        break;
      }

      // ── Work Break Intervals inside a group ──
      case 'list_work_break_group_intervals': {
        const err = requireField(body, 'group_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `work_break_group/${body.group_id}/intervals`, authParam);
        break;
      }

      case 'create_work_break_group_interval': {
        const err = requireField(body, 'group_id', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, `work_break_group/${body.group_id}/intervals`, authParam);
        method = 'POST';
        const intervalBody: Record<string, any> = { name: body.name };
        if (body.max_time) intervalBody.max_time = body.max_time;
        reqBody = JSON.stringify(intervalBody);
        break;
      }

      case 'update_work_break_group_interval': {
        const err1 = requireField(body, 'group_id', corsHeaders);
        if (err1) return err1;
        const err2 = requireField(body, 'interval_id', corsHeaders);
        if (err2) return err2;
        url = buildUrl(baseUrl, `work_break_group/${body.group_id}/intervals/${body.interval_id}`, authParam);
        method = 'PUT';
        const updateBody: Record<string, any> = {};
        if (body.name) updateBody.name = body.name;
        if (body.max_time !== undefined) updateBody.max_time = body.max_time;
        reqBody = JSON.stringify(updateBody);
        break;
      }

      case 'delete_work_break_group_interval': {
        const err1 = requireField(body, 'group_id', corsHeaders);
        if (err1) return err1;
        const err2 = requireField(body, 'interval_id', corsHeaders);
        if (err2) return err2;
        url = buildUrl(baseUrl, `work_break_group/${body.group_id}/intervals/${body.interval_id}`, authParam);
        method = 'DELETE';
        break;
      }

      // ── Manual Call ──
      case 'manual_call_enter':
        url = buildUrl(baseUrl, 'agent/manual_call/enter', authParam);
        method = 'POST';
        break;

      case 'manual_call_dial': {
        const err = requireField(body, 'phone_number', corsHeaders);
        if (err) return err;
        url = buildUrl(baseUrl, 'agent/manual_call/dial', authParam);
        method = 'POST';
        reqBody = JSON.stringify({ phone_number: body.phone_number });
        break;
      }

      case 'manual_call_exit':
        url = buildUrl(baseUrl, 'agent/manual_call/exit', authParam);
        method = 'POST';
        break;

      // ── Agent Login/Logout (agent-level token endpoints) ──
      case 'login_agent_to_campaign': {
        const err1 = requireField(body, 'agent_id', corsHeaders);
        if (err1) return err1;
        const err2 = requireField(body, 'campaign_id', corsHeaders);
        if (err2) return err2;
        const agentLogin = await resolveAgentToken(baseUrl, authParam, body.agent_id);
        if (!agentLogin || !agentLogin.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token de API` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${baseUrl}/agent/login?api_token=${agentLogin.api_token}`;
        method = 'POST';
        reqBody = JSON.stringify({ campaign: body.campaign_id });
        console.log(`Resolved agent token for ${body.agent_id}, calling POST /agent/login`);
        break;
      }

      case 'connect_agent': {
        const err = requireField(body, 'agent_id', corsHeaders);
        if (err) return err;
        const agentConnect = await resolveAgentToken(baseUrl, authParam, body.agent_id);
        if (!agentConnect || !agentConnect.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token de API` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${baseUrl}/agent/connect?api_token=${agentConnect.api_token}`;
        method = 'POST';
        console.log(`Resolved agent token for ${body.agent_id}, calling POST /agent/connect`);
        break;
      }

      case 'logout_agent_self': {
        const err = requireField(body, 'agent_id', corsHeaders);
        if (err) return err;
        const agentLogout = await resolveAgentToken(baseUrl, authParam, body.agent_id);
        if (!agentLogout || !agentLogout.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token de API` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${baseUrl}/agent/logout?api_token=${agentLogout.api_token}`;
        method = 'POST';
        console.log(`Resolved agent token for ${body.agent_id}, calling POST /agent/logout`);
        break;
      }

      case 'agent_available_campaigns': {
        const err = requireField(body, 'agent_id', corsHeaders);
        if (err) return err;
        const agentCamp = await resolveAgentToken(baseUrl, authParam, body.agent_id);
        if (!agentCamp || !agentCamp.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token de API` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${baseUrl}/agent/campaigns?api_token=${agentCamp.api_token}`;
        console.log(`Resolved agent token for ${body.agent_id}, calling GET /agent/campaigns`);
        break;
      }

      // ── Pause / Unpause Agent ──
      case 'pause_agent': {
        const err1 = requireField(body, 'agent_id', corsHeaders);
        if (err1) return err1;
        const err2 = requireField(body, 'interval_id', corsHeaders);
        if (err2) return err2;
        const agentPause = await resolveAgentToken(baseUrl, authParam, body.agent_id);
        if (!agentPause || !agentPause.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${baseUrl}/agent/pause?api_token=${agentPause.api_token}`;
        method = 'POST';
        reqBody = JSON.stringify({ work_break_interval_id: body.interval_id });
        console.log(`Pausing agent ${body.agent_id} with interval ${body.interval_id}`);
        break;
      }

      case 'unpause_agent': {
        const err = requireField(body, 'agent_id', corsHeaders);
        if (err) return err;
        const usersUrlUnpause = buildUrl(baseUrl, 'users', authParam);
        const usersResUnpause = await fetch(usersUrlUnpause, { headers: { 'Content-Type': 'application/json' } });
        if (!usersResUnpause.ok) {
          return new Response(
            JSON.stringify({ status: usersResUnpause.status, detail: 'Falha ao buscar token do agente' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const usersDataUnpause = await usersResUnpause.json();
        const usersListUnpause = Array.isArray(usersDataUnpause) ? usersDataUnpause : usersDataUnpause?.data || [];
        const targetUnpause = usersListUnpause.find((u: any) => u.id === body.agent_id || u.id === Number(body.agent_id));
        if (!targetUnpause || !targetUnpause.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const agentAuthUnpause = `api_token=${targetUnpause.api_token}`;
        url = `${baseUrl}/agent/unpause?${agentAuthUnpause}`;
        method = 'POST';
        console.log(`Unpausing agent ${body.agent_id}`);
        break;
      }

      // ── Qualify Call (auto-tabulation) ──
      case 'qualify_call': {
        const err1 = requireField(body, 'agent_id', corsHeaders);
        if (err1) return err1;
        const err2 = requireField(body, 'call_id', corsHeaders);
        if (err2) return err2;
        const err3 = requireField(body, 'qualification_id', corsHeaders);
        if (err3) return err3;
        // Resolve agent token via GET /users
        const usersUrlQualify = buildUrl(baseUrl, 'users', authParam);
        const usersResQualify = await fetch(usersUrlQualify, { headers: { 'Content-Type': 'application/json' } });
        if (!usersResQualify.ok) {
          return new Response(
            JSON.stringify({ status: usersResQualify.status, detail: 'Falha ao buscar token do agente' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const usersDataQualify = await usersResQualify.json();
        const usersListQualify = Array.isArray(usersDataQualify) ? usersDataQualify : usersDataQualify?.data || [];
        const targetQualify = usersListQualify.find((u: any) => u.id === body.agent_id || u.id === Number(body.agent_id));
        if (!targetQualify || !targetQualify.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const agentAuthQualify = `api_token=${targetQualify.api_token}`;
        url = `${baseUrl}/agent/call/${body.call_id}/qualify?${agentAuthQualify}`;
        method = 'POST';
        reqBody = JSON.stringify({ qualification_id: body.qualification_id });
        console.log(`Qualifying call ${body.call_id} with qualification ${body.qualification_id} for agent ${body.agent_id}`);
        break;
      }

      case 'click2call': {
        if (!body.agent_id || !body.phone_number) {
          return new Response(JSON.stringify({ status: 400, detail: 'agent_id and phone_number are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // 3CPlus click2call requires 'extension' (SIP extension) and 'phone' (destination number)
        // First, fetch the agent user to get their SIP extension number
        const agentIdNum = Number(body.agent_id);
        const usersUrl = buildUrl(baseUrl, `users`, authParam, { per_page: '500' });
        const usersResp = await fetch(usersUrl, { headers: { 'Content-Type': 'application/json' } });
        const usersData = await usersResp.json();
        
        // Find the agent by id to get their extension
        let extension: string | number | undefined;
        if (usersData?.data?.data && Array.isArray(usersData.data.data)) {
          const agent = usersData.data.data.find((u: any) => Number(u.id) === agentIdNum);
          if (agent) {
            extension = agent.extension || agent.extensions?.[0]?.extension || agent.username;
            console.log(`Found agent: id=${agent.id}, extension=${extension}, username=${agent.username}`);
          }
        }
        
        if (!extension) {
          console.log(`Agent ${agentIdNum} extension not found, using agent_id as fallback`);
          extension = agentIdNum;
        }

        // Normalize phone: remove non-digits and ensure Brazil DDI prefix
        let phone = String(body.phone_number).replace(/\D/g, '');
        if (!phone.startsWith('55')) {
          phone = '55' + phone;
        }
        
        console.log(`click2call payload: extension=${extension}, phone=${phone}`);
        url = buildUrl(baseUrl, 'click2call', authParam);
        method = 'POST';
        reqBody = JSON.stringify({ extension, phone });
        break;
      }

      // ── Hangup Call (agent-level) ──
      case 'hangup_call': {
        const err = requireField(body, 'agent_id', corsHeaders);
        if (err) return err;
        const usersUrlHangup = buildUrl(baseUrl, 'users', authParam);
        const usersResHangup = await fetch(usersUrlHangup, { headers: { 'Content-Type': 'application/json' } });
        if (!usersResHangup.ok) {
          return new Response(
            JSON.stringify({ status: usersResHangup.status, detail: 'Falha ao buscar token do agente' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const usersDataHangup = await usersResHangup.json();
        const usersListHangup = Array.isArray(usersDataHangup) ? usersDataHangup : usersDataHangup?.data || [];
        const targetHangup = usersListHangup.find((u: any) => u.id === body.agent_id || u.id === Number(body.agent_id));
        if (!targetHangup || !targetHangup.api_token) {
          return new Response(
            JSON.stringify({ status: 404, detail: `Agente ${body.agent_id} não encontrado ou sem token` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const agentAuthHangup = `api_token=${targetHangup.api_token}`;
        url = `${baseUrl}/agent/hangup?${agentAuthHangup}`;
        method = 'POST';
        console.log(`Hanging up call for agent ${body.agent_id}`);
        break;
      }

      // ── Sync Dispositions (bulk create/update qualifications in a list) ──
      case 'sync_dispositions': {
        const err = requireField(body, 'dispositions', corsHeaders);
        if (err) return err;

        // 1. Find or create a list named "RIVO Tabulações"
        const listsUrl = buildUrl(baseUrl, 'qualification_lists', authParam);
        const listsRes = await fetch(listsUrl, { headers: { 'Content-Type': 'application/json' } });
        const listsData = await listsRes.json();
        const allLists = Array.isArray(listsData) ? listsData : listsData?.data || [];
        let rivoList = allLists.find((l: any) => l.name === 'RIVO Tabulações');
        
        if (!rivoList) {
          const createRes = await fetch(buildUrl(baseUrl, 'qualification_lists', authParam), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'RIVO Tabulações' }),
          });
          rivoList = await createRes.json();
        }

        const listId = rivoList.id;

        // 2. Fetch existing items in the list
        const itemsUrl = buildUrl(baseUrl, `qualification_lists/${listId}/qualifications`, authParam);
        const itemsRes = await fetch(itemsUrl, { headers: { 'Content-Type': 'application/json' } });
        const itemsData = await itemsRes.json();
        const existingItems = Array.isArray(itemsData) ? itemsData : itemsData?.data || [];

        const dispositions = body.dispositions as Array<Record<string, any>>;
        const resultMap: Record<string, number> = {};

        // Maps: RIVO string values -> 3CPlus integer codes
        const BEHAVIOR_MAP: Record<string, number> = {
          'nao_discar_telefone': 1,
          'nao_discar_cliente': 2,
          'repetir': 3,
        };
        const BLOCKLIST_MODE_MAP: Record<string, number> = {
          'indeterminate': 1,
          'custom': 2,
        };

        // Helper: map RIVO disposition fields to 3CPlus qualification payload
        const buildQualPayload = (disp: Record<string, any>) => {
          const payload: Record<string, any> = { name: disp.label };
          if (disp.color) payload.color = disp.color;
          payload.impact = disp.impact === 'positivo' ? 1 : 0;
          payload.behavior = BEHAVIOR_MAP[disp.behavior] || 3;
          if (disp.is_conversion !== undefined) payload.is_conversion = disp.is_conversion ? 1 : 0;
          if (disp.is_cpc !== undefined) payload.is_dmc = disp.is_cpc ? 1 : 0;
          if (disp.is_unknown !== undefined) payload.is_unknown = disp.is_unknown ? 1 : 0;
          if (disp.is_callback !== undefined) payload.is_callback = disp.is_callback ? 1 : 0;
          if (disp.is_schedule !== undefined) payload.is_schedule = disp.is_schedule ? 1 : 0;
          if (disp.is_blocklist !== undefined) payload.add_blocklist = disp.is_blocklist ? 1 : 0;
          if (disp.schedule_allow_other_number !== undefined) payload.allow_schedule_for_another_number = disp.schedule_allow_other_number ? 1 : 0;
          if (disp.schedule_days_limit !== undefined) payload.schedule_days_limit = Number(disp.schedule_days_limit) || 7;
          payload.blocklist_time_type = BLOCKLIST_MODE_MAP[disp.blocklist_mode] || 1;
          if (disp.blocklist_days !== undefined) payload.blocklist_days = Number(disp.blocklist_days) || 0;
          return payload;
        };

        // 3. Create or update items
        for (const disp of dispositions) {
          if (!disp.active) continue;
          const existing = existingItems.find((item: any) => item.name === disp.label);
          if (existing) {
            // Update existing item with full payload
            const updatePayload = buildQualPayload(disp);
            const updateItemRes = await fetch(buildUrl(baseUrl, `qualification_lists/${listId}/qualifications/${existing.id}`, authParam), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatePayload),
            });
            if (!updateItemRes.ok) {
              const errText = await updateItemRes.text();
              console.error(`Failed to update qualification "${disp.label}": ${updateItemRes.status} ${errText.substring(0, 300)}`);
            }
            resultMap[disp.key] = existing.id;
          } else {
            const createPayload = buildQualPayload(disp);
            console.log(`Creating qualification "${disp.label}" with payload:`, JSON.stringify(createPayload));
            const createItemRes = await fetch(buildUrl(baseUrl, `qualification_lists/${listId}/qualifications`, authParam), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(createPayload),
            });
            if (!createItemRes.ok) {
              const errText = await createItemRes.text();
              console.error(`Failed to create qualification "${disp.label}": ${createItemRes.status} ${errText.substring(0, 300)}`);
              continue;
            }
            const newItem = await createItemRes.json();
            if (newItem?.id) {
              resultMap[disp.key] = newItem.id;
            } else {
              console.error(`Created qualification "${disp.label}" but got no id:`, JSON.stringify(newItem));
            }
          }
        }

        // 4. Remove items that are no longer active
        const activeLabels = new Set(dispositions.filter(d => d.active).map(d => d.label));
        for (const item of existingItems) {
          if (!activeLabels.has(item.name)) {
            await fetch(buildUrl(baseUrl, `qualification_lists/${listId}/qualifications/${item.id}`, authParam), {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        return new Response(
          JSON.stringify({ status: 200, list_id: listId, disposition_map: resultMap }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
