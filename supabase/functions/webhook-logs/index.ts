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

    // Extract project ref from supabase URL
    const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\./);
    const projectRef = refMatch ? refMatch[1] : "";

    if (!projectRef) {
      throw new Error("Could not extract project ref from SUPABASE_URL");
    }

    // Use the Supabase Management API to get edge function logs
    const logsUrl = `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.edge-logs?iso_timestamp_start=${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}&iso_timestamp_end=${new Date().toISOString()}`;

    const logsRes = await fetch(logsUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
    });

    const logsText = await logsRes.text();
    console.log("Logs API status:", logsRes.status, "body preview:", logsText.substring(0, 200));

    let allLogs: any[] = [];

    try {
      const parsed = JSON.parse(logsText);
      if (Array.isArray(parsed)) {
        allLogs = parsed;
      } else if (parsed && Array.isArray(parsed.result)) {
        allLogs = parsed.result;
      } else if (parsed && Array.isArray(parsed.data)) {
        allLogs = parsed.data;
      }
    } catch {
      // If analytics API doesn't work, fall back to querying function_edge_logs
      console.log("Analytics API failed, trying BigQuery-style query");
    }

    // If no logs from management API, try the analytics query endpoint
    if (allLogs.length === 0) {
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

      const edgeText = await analyticsRes.text();
      
      try {
        const parsed = JSON.parse(edgeText);
        if (Array.isArray(parsed)) allLogs = parsed;
        else if (parsed?.result && Array.isArray(parsed.result)) allLogs = parsed.result;
      } catch {
        console.error("Analytics query parse failed:", edgeText.substring(0, 200));
      }
    }

    // Also get console-level logs via function_logs
    const fnQuery = `
      select id, function_logs.timestamp, event_message, metadata.level, metadata.function_id
      from function_logs
        cross join unnest(metadata) as metadata
      order by timestamp desc
      limit ${limit}
    `;

    const fnRes = await fetch(`${supabaseUrl}/analytics/v1/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ query: fnQuery }),
    });

    const fnText = await fnRes.text();
    let fnLogs: any[] = [];
    try {
      const parsed = JSON.parse(fnText);
      if (Array.isArray(parsed)) fnLogs = parsed;
      else if (parsed?.result && Array.isArray(parsed.result)) fnLogs = parsed.result;
    } catch {
      console.error("Function logs parse failed:", fnText.substring(0, 200));
    }

    // Format edge logs
    const formattedEdge = (Array.isArray(allLogs) ? allLogs : []).map((l: any) => ({
      id: l.id || crypto.randomUUID(),
      timestamp: l.timestamp,
      message: l.event_message || l.message || JSON.stringify(l),
      type: "http" as const,
      status_code: l.status_code,
      method: l.method,
      execution_time_ms: l.execution_time_ms,
    }));

    // Format function logs
    const formattedFn = (Array.isArray(fnLogs) ? fnLogs : []).map((l: any) => ({
      id: l.id || crypto.randomUUID(),
      timestamp: l.timestamp,
      message: l.event_message || l.message || JSON.stringify(l),
      type: "log" as const,
      level: l.level,
    }));

    const combined = [...formattedEdge, ...formattedFn]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return new Response(JSON.stringify({ success: true, logs: combined, count: combined.length }), {
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
