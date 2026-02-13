const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, domain, api_token, campaign_id, list_id, mailings } = await req.json();

    if (!domain || !api_token) {
      return new Response(
        JSON.stringify({ status: 400, detail: 'domain and api_token are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = `https://${domain}/api/v1`;
    const authParam = `api_token=${api_token}`;

    let url = '';
    let method = 'GET';
    let body: string | undefined;

    switch (action) {
      case 'list_campaigns':
        url = `${baseUrl}/campaigns?${authParam}`;
        break;

      case 'get_campaign_lists':
        if (!campaign_id) {
          return new Response(
            JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${baseUrl}/campaigns/${campaign_id}/lists?${authParam}`;
        break;

      case 'create_list':
        if (!campaign_id) {
          return new Response(
            JSON.stringify({ status: 400, detail: 'campaign_id is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        url = `${baseUrl}/campaigns/${campaign_id}/lists?${authParam}`;
        method = 'POST';
        body = JSON.stringify({ name: `CollectFlow ${new Date().toLocaleDateString('pt-BR')}` });
        break;

      case 'send_mailing':
        if (!campaign_id || !list_id || !mailings) {
          return new Response(
            JSON.stringify({ status: 400, detail: 'campaign_id, list_id and mailings are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Use "create mailing by array" endpoint (accepts JSON with header + mailing)
        url = `${baseUrl}/campaigns/${campaign_id}/lists/${list_id}/mailing?${authParam}`;
        method = 'POST';
        body = JSON.stringify({
          header: ['identifier', 'areacodephone', 'Nome', 'Extra1', 'Extra2', 'Extra3'],
          mailing: mailings,
        });
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
    if (body) {
      fetchOptions.body = body;
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
