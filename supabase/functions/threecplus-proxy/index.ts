const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      action, domain, api_token,
      campaign_id, list_id, mailings,
      campaign_name, start_time, end_time, qualification_list_id,
      agent_id, campaign_data,
    } = body;

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
      // ── Existing actions ──
      case 'list_campaigns':
        url = `${baseUrl}/campaigns?${authParam}`;
        break;

      case 'get_campaign_lists':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}/lists?${authParam}`;
        break;

      case 'create_list':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}/lists?${authParam}`;
        method = 'POST';
        reqBody = JSON.stringify({ name: `CollectFlow ${new Date().toLocaleDateString('pt-BR')}` });
        break;

      case 'send_mailing':
        if (!campaign_id || !list_id || !mailings) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id, list_id and mailings are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}/lists/${list_id}/mailing?${authParam}`;
        method = 'POST';
        reqBody = JSON.stringify({
          header: ['identifier', 'areacodephone', 'Nome', 'Extra1', 'Extra2', 'Extra3'],
          mailing: mailings,
        });
        break;

      case 'create_campaign': {
        if (!campaign_name) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_name is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns?${authParam}`;
        method = 'POST';
        reqBody = JSON.stringify({
          name: campaign_name,
          start_time: start_time || '08:00',
          end_time: end_time || '18:30',
          qualification_list: qualification_list_id || null,
        });
        break;
      }

      // ── Dashboard: agents ──
      case 'agents_online':
        url = `${baseUrl}/agents/online?${authParam}`;
        break;

      case 'agents_status':
        url = `${baseUrl}/agents/status?${authParam}`;
        break;

      case 'logout_agent':
        if (!agent_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'agent_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/agents/${agent_id}/logout?${authParam}`;
        method = 'POST';
        break;

      // ── Dashboard: calls ──
      case 'company_calls':
        url = `${baseUrl}/company/calls?${authParam}`;
        break;

      case 'campaign_calls':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}/calls?${authParam}`;
        break;

      // ── Dashboard: campaign details ──
      case 'campaign_agents_status':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}/agents/status?${authParam}`;
        break;

      case 'campaign_statistics':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const today = new Date().toISOString().split('T')[0];
        const startDate = body.startDate || today;
        const endDate = body.endDate || today;
        url = `${baseUrl}/campaigns/${campaign_id}/statistics?${authParam}&startDate=${startDate}&endDate=${endDate}`;
        break;

      // ── Dashboard: campaign controls ──
      case 'update_campaign':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}?${authParam}`;
        method = 'PATCH';
        reqBody = JSON.stringify(campaign_data || {});
        break;

      case 'pause_campaign':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}/pause?${authParam}`;
        method = 'PUT';
        break;

      case 'resume_campaign':
        if (!campaign_id) {
          return new Response(JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        url = `${baseUrl}/campaigns/${campaign_id}/resume?${authParam}`;
        method = 'PUT';
        break;

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
    const data = await response.json();

    console.log(`3CPlus response: ${response.status}`);

    return new Response(
      JSON.stringify(data),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('3CPlus proxy error:', error);
    return new Response(
      JSON.stringify({ status: 500, detail: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
