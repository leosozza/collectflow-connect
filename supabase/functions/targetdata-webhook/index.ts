import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

/** Extract all phones from a Target Data result object */
function extractPhones(result: any): { number: string; type: string; priority: number; isWhatsApp: boolean; raw: any }[] {
  const phones: { number: string; type: string; priority: number; isWhatsApp: boolean; raw: any }[] = [];
  const seen = new Set<string>();

  // New nested schema: contato.telefone[]
  const telefones = result?.contato?.telefone || [];
  for (const t of telefones) {
    const classified = classifyTdPhone(t);
    if (classified.number.length >= 10 && !seen.has(classified.number)) {
      seen.add(classified.number);
      phones.push(classified);
    }
  }

  // Fallback: flat fields
  if (phones.length === 0) {
    if (result.telefones && Array.isArray(result.telefones)) {
      result.telefones.forEach((t: any) => {
        const num = typeof t === "string" ? t : t.numero || t.telefone || "";
        const clean = num.replace(/\D/g, "");
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          phones.push({ number: clean, type: "desconhecido", priority: 3, isWhatsApp: false, raw: t });
        }
      });
    } else if (result.celular) {
      const clean = String(result.celular).replace(/\D/g, "");
      if (clean) phones.push({ number: clean, type: "celular", priority: 1, isWhatsApp: clean.length === 11, raw: null });
    }
    if (result.telefone_fixo) {
      const clean = String(result.telefone_fixo).replace(/\D/g, "");
      if (clean && !seen.has(clean)) phones.push({ number: clean, type: "fixo", priority: 3, isWhatsApp: false, raw: null });
    }
  }

  phones.sort((a, b) => a.priority - b.priority);
  return phones;
}

/** Extract emails from Target Data result */
function extractEmails(result: any): string[] {
  const emails: string[] = [];
  // New nested schema
  const list = result?.contato?.email || [];
  for (const e of list) {
    const addr = typeof e === "string" ? e : e.ds_email || "";
    if (addr) emails.push(addr);
  }
  // Fallback: flat fields
  if (emails.length === 0) {
    if (result.emails && Array.isArray(result.emails)) {
      result.emails.forEach((e: any) => {
        const addr = typeof e === "string" ? e : e.email || e.endereco || "";
        if (addr) emails.push(addr);
      });
    } else if (result.email) {
      emails.push(result.email);
    }
  }
  return emails;
}

/** Extract address from Target Data result */
function extractAddress(result: any): { endereco: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null } {
  // New nested schema
  const enderecos = result?.contato?.endereco || [];
  if (enderecos.length > 0) {
    const addr = enderecos[0];
    return {
      endereco: addr.ds_logradouro || null,
      bairro: addr.ds_bairro || null,
      cidade: addr.ds_cidade || null,
      uf: addr.sg_uf || null,
      cep: addr.nr_cep ? String(addr.nr_cep).replace(/\D/g, "") : null,
    };
  }
  // Fallback: flat fields
  return {
    endereco: result.endereco || result.logradouro || null,
    bairro: result.bairro || null,
    cidade: result.cidade || result.municipio || null,
    uf: result.uf || result.estado || null,
    cep: result.cep ? String(result.cep).replace(/\D/g, "") : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Optional secret validation
    const webhookSecret = Deno.env.get("TARGETDATA_WEBHOOK_SECRET");
    if (webhookSecret) {
      const headerSecret = req.headers.get("x-webhook-secret") || "";
      if (headerSecret !== webhookSecret) {
        console.error("[targetdata-webhook] Invalid webhook secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    console.log("[targetdata-webhook] Payload received:", JSON.stringify(payload).slice(0, 500));

    // Accept both single record and array; support Target Data's { header, results[] }
    const records: any[] = Array.isArray(payload.results || payload.data || payload)
      ? (payload.results || payload.data || payload)
      : payload.results ? [payload.results] : payload.data ? [payload.data] : [payload];

    const jobId = payload.job_id || payload.jobId || null;
    const tenantId = payload.tenant_id || payload.tenantId || null;

    let enrichedCount = 0;
    let failedCount = 0;

    for (const record of records) {
      // Support both nested (cadastral.nr_cpf) and flat (cpf/documento)
      const cpf = (record?.cadastral?.nr_cpf || record.cpf || record.documento || "").replace(/\D/g, "");
      if (!cpf) {
        failedCount++;
        continue;
      }

      const allPhones = extractPhones(record);
      const emails = extractEmails(record);
      const address = extractAddress(record);

      const updateData: Record<string, any> = {
        enrichment_data: record,
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

      // Build query — scope to tenant if provided
      let query = supabase
        .from("clients")
        .update(updateData)
        .filter("cpf", "ilike", `%${cpf.slice(-8)}%`);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { error: updateError } = await query;

      if (updateError) {
        console.error(`[targetdata-webhook] Error updating CPF ${cpf}:`, updateError.message);
        failedCount++;

        if (jobId) {
          await supabase.from("enrichment_logs").insert({
            job_id: jobId,
            cpf,
            status: "error",
            data_returned: { error: updateError.message },
          });
        }
        continue;
      }

      // Save ALL phones to client_phones table
      if (tenantId) {
        for (let p = 0; p < allPhones.length; p++) {
          const phone = allPhones[p];
          const digits = phone.number.replace(/\D/g, "");
          const phoneE164 = normalizeToE164(digits);
          const phoneLast8 = digits.slice(-8);
          const phoneLast10 = digits.slice(-10);
          await supabase.from("client_phones").upsert(
            {
              tenant_id: tenantId,
              cpf,
              phone_number: phone.number,
              phone_type: phone.type,
              priority: p + 1,
              is_whatsapp: phone.isWhatsApp,
              source: "targetdata",
              raw_metadata: phone.raw || {},
              phone_e164: phoneE164,
              phone_last8: phoneLast8,
              phone_last10: phoneLast10,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,cpf,phone_number" }
          );
        }
      }

      enrichedCount++;

      if (jobId) {
        await supabase.from("enrichment_logs").insert({
          job_id: jobId,
          cpf,
          status: "success",
          data_returned: record,
        });
      }
    }

    // Update job if provided
    if (jobId) {
      await supabase
        .from("enrichment_jobs")
        .update({
          enriched: enrichedCount,
          failed: failedCount,
          processed: enrichedCount + failedCount,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    }

    console.log(`[targetdata-webhook] Done: ${enrichedCount} enriched, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ ok: true, enriched: enrichedCount, failed: failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[targetdata-webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
