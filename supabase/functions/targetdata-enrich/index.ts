import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Classify phone from Target Data contato.telefone[] entry */
function classifyTdPhone(entry: any): { number: string; type: string; priority: number; isWhatsApp: boolean; raw: any } {
  const ddd = String(entry.nr_ddd || "").replace(/\D/g, "");
  const num = String(entry.nr_telefone || "").replace(/\D/g, "");
  const full = ddd + num;
  const tipo = String(entry.ds_tipo_telefone || "").toLowerCase();

  const isMobile = tipo.includes("movel") || tipo.includes("celular") || (full.length === 11 && full[2] === "9");
  const isWhatsApp = isMobile && full.length === 11;

  return {
    number: full,
    type: isMobile ? "celular" : "fixo",
    priority: isMobile ? (isWhatsApp ? 1 : 2) : 3,
    isWhatsApp,
    raw: entry,
  };
}

/** Extract all phones from a Target Data result object (new schema) */
function extractPhones(result: any): { number: string; type: string; priority: number; isWhatsApp: boolean; raw: any }[] {
  const phones: { number: string; type: string; priority: number; isWhatsApp: boolean; raw: any }[] = [];
  const seen = new Set<string>();

  const telefones = result?.contato?.telefone || [];
  for (const t of telefones) {
    const classified = classifyTdPhone(t);
    if (classified.number.length >= 10 && !seen.has(classified.number)) {
      seen.add(classified.number);
      phones.push(classified);
    }
  }

  phones.sort((a, b) => a.priority - b.priority);
  return phones;
}

/** Extract emails from Target Data result */
function extractEmails(result: any): string[] {
  const emails: string[] = [];
  const list = result?.contato?.email || [];
  for (const e of list) {
    const addr = typeof e === "string" ? e : e.ds_email || "";
    if (addr) emails.push(addr);
  }
  return emails;
}

/** Extract address from Target Data result */
function extractAddress(result: any): { endereco: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null } {
  const enderecos = result?.contato?.endereco || [];
  if (enderecos.length === 0) return { endereco: null, bairro: null, cidade: null, uf: null, cep: null };
  const addr = enderecos[0];
  return {
    endereco: addr.ds_logradouro || null,
    bairro: addr.ds_bairro || null,
    cidade: addr.ds_cidade || null,
    uf: addr.sg_uf || null,
    cep: addr.nr_cep ? String(addr.nr_cep).replace(/\D/g, "") : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("TARGETDATA_API_KEY");
    const apiSecret = Deno.env.get("TARGETDATA_API_SECRET");

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ error: "Target Data credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, cpfs, job_id, cost_per_client } = await req.json();

    if (!tenant_id || !cpfs?.length || !job_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tenant_id, cpfs, job_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unitCost = cost_per_client || 0.15;
    const tokensPerClient = 1;

    await supabase
      .from("enrichment_jobs")
      .update({ status: "processing" })
      .eq("id", job_id);

    let enrichedCount = 0;
    let failedCount = 0;
    let processedCount = 0;

    // Process in batches of 10
    for (let i = 0; i < cpfs.length; i += 10) {
      const batch = cpfs.slice(i, i + 10);

      try {
        // FIXED: correct URL with /api prefix
        const response = await fetch("https://api.targetdata.com.br/api/v1/search/pf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            api_secret: apiSecret,
            cpfs: batch,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          for (const cpf of batch) {
            await supabase.from("enrichment_logs").insert({
              job_id, cpf: cpf.replace(/\D/g, ""), status: "error",
              data_returned: { error: `API returned ${response.status}`, body: errorBody },
            });
            failedCount++;
            processedCount++;
          }
          await supabase.from("enrichment_jobs")
            .update({ processed: processedCount, failed: failedCount, enriched: enrichedCount })
            .eq("id", job_id);
          continue;
        }

        const apiResponse = await response.json();
        
        // FIXED: Target Data returns { header, results[] }
        const results: any[] = apiResponse.results || apiResponse.data || [];

        for (const cpf of batch) {
          const cleanCpf = cpf.replace(/\D/g, "");
          
          // FIXED: match by cadastral.nr_cpf
          const match = Array.isArray(results)
            ? results.find((r: any) => {
                const rCpf = (r?.cadastral?.nr_cpf || r?.cpf || r?.documento || "").replace(/\D/g, "");
                return rCpf === cleanCpf;
              })
            : null;

          if (match) {
            const allPhones = extractPhones(match);
            const emails = extractEmails(match);
            const address = extractAddress(match);

            const updateData: Record<string, any> = {
              enrichment_data: match,
              updated_at: new Date().toISOString(),
            };

            if (allPhones.length > 0) updateData.phone = allPhones[0].number;
            if (allPhones.length > 1) updateData.phone2 = allPhones[1].number;
            if (allPhones.length > 2) updateData.phone3 = allPhones[2].number;
            if (emails.length > 0) updateData.email = emails[0];
            if (address.endereco) updateData.endereco = address.endereco;
            if (address.bairro) updateData.bairro = address.bairro;
            if (address.cidade) updateData.cidade = address.cidade;
            if (address.uf) updateData.uf = address.uf;
            if (address.cep) updateData.cep = address.cep;

            await supabase
              .from("clients")
              .update(updateData)
              .eq("tenant_id", tenant_id)
              .filter("cpf", "ilike", `%${cleanCpf.slice(-8)}%`);

            // Save ALL phones to client_phones table
            for (let p = 0; p < allPhones.length; p++) {
              const phone = allPhones[p];
              await supabase.from("client_phones").upsert(
                {
                  tenant_id,
                  cpf: cleanCpf,
                  phone_number: phone.number,
                  phone_type: phone.type,
                  priority: p + 1,
                  is_whatsapp: phone.isWhatsApp,
                  source: "targetdata",
                  raw_metadata: phone.raw || {},
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "tenant_id,cpf,phone_number" }
              );
            }

            // Consume 1 token
            await supabase.rpc("consume_tokens", {
              p_tenant_id: tenant_id,
              p_amount: tokensPerClient,
              p_service_code: "higienizacao",
              p_description: `Higienização CPF ${cleanCpf.slice(0, 3)}...${cleanCpf.slice(-3)}`,
              p_reference_id: job_id,
              p_reference_type: "enrichment_job",
              p_metadata: {},
            });

            await supabase.from("enrichment_logs").insert({
              job_id, cpf: cleanCpf, status: "success", data_returned: match,
            });

            enrichedCount++;
          } else {
            await supabase.from("enrichment_logs").insert({
              job_id, cpf: cleanCpf, status: "not_found", data_returned: null,
            });
            failedCount++;
          }
          processedCount++;
        }

        await supabase.from("enrichment_jobs")
          .update({ processed: processedCount, enriched: enrichedCount, failed: failedCount })
          .eq("id", job_id);
      } catch (batchError: any) {
        for (const cpf of batch) {
          await supabase.from("enrichment_logs").insert({
            job_id, cpf: cpf.replace(/\D/g, ""), status: "error",
            data_returned: { error: batchError.message },
          });
          failedCount++;
          processedCount++;
        }
        await supabase.from("enrichment_jobs")
          .update({ processed: processedCount, failed: failedCount, enriched: enrichedCount })
          .eq("id", job_id);
      }

      if (i + 10 < cpfs.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Final update
    await supabase
      .from("enrichment_jobs")
      .update({
        status: "completed",
        processed: processedCount,
        enriched: enrichedCount,
        failed: failedCount,
        total_cost: enrichedCount * unitCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({
        success: true,
        total: cpfs.length,
        enriched: enrichedCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
