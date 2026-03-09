import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Allowed tenant slugs
const ALLOWED_SLUGS = ["maxfama", "temis"];

// State number to UF abbreviation map
const STATE_TO_UF: Record<number, string> = {
  1: "AC", 2: "AL", 3: "AP", 4: "AM", 5: "BA", 6: "CE", 7: "DF", 8: "ES",
  9: "GO", 10: "MA", 11: "MT", 12: "MS", 13: "MG", 14: "PA", 15: "PB",
  16: "PR", 17: "PE", 18: "PI", 19: "RJ", 20: "RN", 21: "RS", 22: "RO",
  23: "RR", 24: "SC", 25: "SE", 26: "SP", 27: "TO",
};

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

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "installments";

    // === Agencies endpoint ===
    if (action === "agencies") {
      const agenciesUrl = "https://maxsystem.azurewebsites.net/api/Agencies?%24inlinecount=allpages";
      const agResp = await fetch(agenciesUrl);
      if (!agResp.ok) {
        const text = await agResp.text();
        return new Response(JSON.stringify({ error: "MaxSystem agencies error", details: text }), {
          status: agResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const agData = await agResp.json();
      return new Response(JSON.stringify({ Items: agData.Items }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Model Search endpoint ===
    if (action === "model-search") {
      const contractNumber = url.searchParams.get("contractNumber");
      if (!contractNumber) {
        return new Response(JSON.stringify({ error: "contractNumber is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const searchUrl = `https://maxsystem.azurewebsites.net/api/NewModelSearch?%24top=1&%24filter=(ContractNumber+eq+${contractNumber})`;
      const resp = await fetch(searchUrl);
      if (!resp.ok) {
        const text = await resp.text();
        return new Response(JSON.stringify({ error: "MaxSystem model-search error", details: text }), {
          status: resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await resp.json();
      const item = (json.Items || [])[0] || null;
      return new Response(JSON.stringify({ item }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Model Details endpoint ===
    if (action === "model-details") {
      const modelId = url.searchParams.get("modelId");
      if (!modelId) {
        return new Response(JSON.stringify({ error: "modelId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const detailsUrl = `https://maxsystem.azurewebsites.net/api/NewModelSearch/Details/${modelId}`;
      const resp = await fetch(detailsUrl);
      if (!resp.ok) {
        const text = await resp.text();
        return new Response(JSON.stringify({ error: "MaxSystem model-details error", details: text }), {
          status: resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const details = await resp.json();
      return new Response(JSON.stringify({
        Address: details.Address || null,
        CEP: details.CEP || null,
        Neighborhood: details.Neighborhood || null,
        City: details.City || null,
        State: details.State != null ? (STATE_TO_UF[details.State] || null) : null,
        Email: details.Email || null,
        ModelName: details.ModelName || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Model Names (batch) endpoint ===
    if (action === "model-names") {
      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "POST required" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await req.json();
      const contractNumbers: string[] = body.contractNumbers || [];
      if (contractNumbers.length === 0) {
        return new Response(JSON.stringify({ modelNames: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const modelNames: Record<string, string> = {};
      const BATCH = 10;

      for (let i = 0; i < contractNumbers.length; i += BATCH) {
        const chunk = contractNumbers.slice(i, i + BATCH);
        await Promise.all(chunk.map(async (cn) => {
          try {
            // Step 1: Search for the model ID by ContractNumber
            const searchUrl = `https://maxsystem.azurewebsites.net/api/NewModelSearch?%24top=1&%24filter=(ContractNumber+eq+'${cn}')`;
            const resp = await fetch(searchUrl);
            if (!resp.ok) return;
            const json = await resp.json();
            const item = (json.Items || [])[0];
            if (!item?.Id) return;

            // Step 2: Fetch details to get ModelName
            const detailsUrl = `https://maxsystem.azurewebsites.net/api/NewModelSearch/Details/${item.Id}`;
            const detResp = await fetch(detailsUrl);
            if (!detResp.ok) return;
            const details = await detResp.json();
            if (details?.ModelName) {
              modelNames[cn] = details.ModelName;
            }
          } catch { /* skip */ }
        }));
      }

      return new Response(JSON.stringify({ modelNames }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Installments endpoint (existing) ===
    const filter = url.searchParams.get("filter") || "";
    const top = url.searchParams.get("top") || "50000";

    if (!filter) {
      return new Response(JSON.stringify({ error: "Filter is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxUrl = `https://maxsystem.azurewebsites.net/api/Installment?%24inlinecount=allpages&%24top=${top}&%24orderby=ResponsibleCPF+desc&%24filter=${encodeURI(filter)}`;

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
