import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { secret_key } = body;

    // Simple secret check to prevent unauthorized use
    if (secret_key !== "cleanup-2026-04-01") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const KEEP_EMAILS = ["raulsjunior579@gmail.com", "raul@temisconsultoria.com.br"];

    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const users = data?.users || [];
    const results: any[] = [];

    for (const u of users) {
      const keep = KEEP_EMAILS.includes(u.email || "");
      if (!keep) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        results.push({ email: u.email, id: u.id, action: "deleted", error: error?.message || null });
      } else {
        results.push({ email: u.email, id: u.id, action: "kept" });
      }
    }

    // List remaining
    const { data: remaining } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const remainingList = remaining?.users?.map(u => ({ email: u.email, id: u.id })) || [];

    return new Response(JSON.stringify({ results, remaining: remainingList }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
