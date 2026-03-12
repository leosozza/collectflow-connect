import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Classify and prioritize a phone number */
function classifyPhone(raw: string): { number: string; type: string; priority: number; isWhatsApp: boolean } {
  const clean = raw.replace(/\D/g, "");
  if (clean.length < 10) return { number: clean, type: "desconhecido", priority: 99, isWhatsApp: false };

  // 11 digits and 3rd digit is 9 → mobile (likely WhatsApp)
  if (clean.length === 11 && clean[2] === "9") {
    return { number: clean, type: "celular", priority: 1, isWhatsApp: true };
  }
  // 11 digits but 3rd digit is not 9 → could be landline with 9-digit area
  if (clean.length === 11) {
    return { number: clean, type: "celular", priority: 2, isWhatsApp: false };
  }
  // 10 digits → landline
  if (clean.length === 10) {
    return { number: clean, type: "fixo", priority: 3, isWhatsApp: false };
  }
  return { number: clean, type: "outro", priority: 4, isWhatsApp: false };
}

/** Extract all phones from a Target Data match object */
function extractPhones(match: any): { number: string; type: string; priority: number; isWhatsApp: boolean; raw: any }[] {
  const phones: { number: string; type: string; priority: number; isWhatsApp: boolean; raw: any }[] = [];
  const seen = new Set<string>();

  const addPhone = (raw: string, metadata: any = null) => {
    const classified = classifyPhone(raw);
    if (classified.number.length >= 10 && !seen.has(classified.number)) {
      seen.add(classified.number);
      phones.push({ ...classified, raw: metadata });
    }
  };

  if (match.telefones && Array.isArray(match.telefones)) {
    match.telefones.forEach((t: any) => {
      const num = typeof t === "string" ? t : t.numero || t.telefone || "";
      if (num) addPhone(num, t);
    });
  }
  if (match.celular) addPhone(String(match.celular));
  if (match.telefone_fixo) addPhone(String(match.telefone_fixo));
  if (match.telefone) addPhone(String(match.telefone));
  if (match.telefone_comercial) addPhone(String(match.telefone_comercial));

  // Sort by priority (lower = better)
  phones.sort((a, b) => a.priority - b.priority);
  return phones;
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

    // Validate user from JWT
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

    // Update job status to processing
    await supabase
      .from("enrichment_jobs")
      .update({ status: "processing" })
      .eq("id", job_id);

    let enrichedCount = 0;
    let failedCount = 0;
    let processedCount = 0;

    // Process in batches of 10 (Target Data limit)
    for (let i = 0; i < cpfs.length; i += 10) {
      const batch = cpfs.slice(i, i + 10);

      try {
        const response = await fetch("https://api.targetdata.com.br/v1/search/pf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            api_secret: apiSecret,
            cpfs: batch,
          }),
        });

        if (!response.ok) {
          for (const cpf of batch) {
            await supabase.from("enrichment_logs").insert({
              job_id, cpf, status: "error",
              data_returned: { error: `API returned ${response.status}` },
            });
            failedCount++;
            processedCount++;
          }
          await supabase.from("enrichment_jobs")
            .update({ processed: processedCount, failed: failedCount, enriched: enrichedCount })
            .eq("id", job_id);
          continue;
        }

        const result = await response.json();
        const results = result.data || result.results || result || [];

        for (const cpf of batch) {
          const cleanCpf = cpf.replace(/\D/g, "");
          const match = Array.isArray(results)
            ? results.find(
                (r: any) => (r.cpf || r.documento || "").replace(/\D/g, "") === cleanCpf
              )
            : null;

          if (match) {
            // Extract and prioritize phones
            const allPhones = extractPhones(match);

            // Extract email
            const emails: string[] = [];
            if (match.emails && Array.isArray(match.emails)) {
              match.emails.forEach((e: any) => {
                const addr = typeof e === "string" ? e : e.email || e.endereco || "";
                if (addr) emails.push(addr);
              });
            } else if (match.email) {
              emails.push(match.email);
            }

            // Extract address
            const endereco = match.endereco || match.logradouro || null;
            const bairro = match.bairro || null;
            const cidade = match.cidade || match.municipio || null;
            const uf = match.uf || match.estado || null;
            const cep = match.cep ? String(match.cep).replace(/\D/g, "") : null;

            // Update client records — top 3 phones go to main fields
            const updateData: Record<string, any> = {
              enrichment_data: match,
              updated_at: new Date().toISOString(),
            };

            if (allPhones.length > 0) updateData.phone = allPhones[0].number;
            if (allPhones.length > 1) updateData.phone2 = allPhones[1].number;
            if (allPhones.length > 2) updateData.phone3 = allPhones[2].number;
            if (emails.length > 0) updateData.email = emails[0];
            if (endereco) updateData.endereco = endereco;
            if (bairro) updateData.bairro = bairro;
            if (cidade) updateData.cidade = cidade;
            if (uf) updateData.uf = uf;
            if (cep) updateData.cep = cep;

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
