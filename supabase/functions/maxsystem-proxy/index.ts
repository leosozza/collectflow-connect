import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Allowed tenant slugs
const ALLOWED_SLUGS = ["maxfama", "temis"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Get tenant slug
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tu } = await adminClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (!tu) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tenant } = await adminClient
      .from("tenants")
      .select("slug")
      .eq("id", tu.tenant_id)
      .single();

    if (!tenant || !ALLOWED_SLUGS.includes(tenant.slug)) {
      return new Response(JSON.stringify({ error: "Acesso não autorizado para este tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build MaxSystem URL from query params
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "";
    const top = url.searchParams.get("top") || "50000";

    const maxUrl = `https://maxsystem.azurewebsites.net/api/Installment?%24inlinecount=allpages&%24top=${top}&%24orderby=ResponsibleCPF+desc&%24filter=(${encodeURI(filter)})`;

    const response = await fetch(maxUrl);
    if (!response.ok) {
      const text = await response.text();
      return new Response(JSON.stringify({ error: "MaxSystem error", details: text }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({ Items: data.Items, Count: data.Count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
