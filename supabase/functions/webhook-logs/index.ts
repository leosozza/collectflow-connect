const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const functionName = body.function_name || "gupshup-webhook";
    const limit = Math.min(body.limit || 50, 100);

    // Query analytics for edge function logs
    const query = `
      select id, function_edge_logs.timestamp, event_message, response.status_code, request.method, m.function_id, m.execution_time_ms
      from function_edge_logs
        cross join unnest(metadata) as m
        cross join unnest(m.response) as response
        cross join unnest(m.request) as request
      order by timestamp desc
      limit ${limit}
    `;

    const analyticsRes = await fetch(`${supabaseUrl}/analytics/v1/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query }),
    });

    // Also fetch function-level logs (console.log output)
    const fnLogsQuery = `
      select id, function_logs.timestamp, event_message, metadata.level, metadata.function_id
      from function_logs
        cross join unnest(metadata) as metadata
      order by timestamp desc
      limit ${limit}
    `;

    const fnLogsRes = await fetch(`${supabaseUrl}/analytics/v1/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: fnLogsQuery }),
    });

    const edgeText = await analyticsRes.text();
    const fnText = await fnLogsRes.text();

    let edgeLogs: any[] = [];
    let fnLogs: any[] = [];

    try {
      const edgeData = JSON.parse(edgeText);
      edgeLogs = edgeData.result || edgeData || [];
    } catch {
      console.error("Failed to parse edge logs:", edgeText.substring(0, 500));
    }

    try {
      const fnData = JSON.parse(fnText);
      fnLogs = fnData.result || fnData || [];
    } catch {
      console.error("Failed to parse fn logs:", fnText.substring(0, 500));
    }

    // Combine and sort by timestamp desc
    const combined = [
      ...edgeLogs.map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp,
        message: l.event_message,
        type: "http",
        status_code: l.status_code,
        method: l.method,
        execution_time_ms: l.execution_time_ms,
      })),
      ...fnLogs.map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp,
        message: l.event_message,
        type: "log",
        level: l.level,
      })),
    ]
      .sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return tb - ta;
      })
      .slice(0, limit);

    return new Response(JSON.stringify({ success: true, logs: combined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("webhook-logs error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
