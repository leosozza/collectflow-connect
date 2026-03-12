import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractPhones(record: any): string[] {
  const phones: string[] = [];
  if (record.telefones && Array.isArray(record.telefones)) {
    record.telefones.forEach((t: any) => {
      const num = typeof t === "string" ? t : t.numero || t.telefone || "";
      if (num) phones.push(num.replace(/\D/g, ""));
    });
  } else if (record.celular) {
    phones.push(String(record.celular).replace(/\D/g, ""));
  }
  if (record.telefone_fixo) {
    phones.push(String(record.telefone_fixo).replace(/\D/g, ""));
  }
  return phones;
}

function extractEmails(record: any): string[] {
  const emails: string[] = [];
  if (record.emails && Array.isArray(record.emails)) {
    record.emails.forEach((e: any) => {
      const addr = typeof e === "string" ? e : e.email || e.endereco || "";
      if (addr) emails.push(addr);
    });
  } else if (record.email) {
    emails.push(record.email);
  }
  return emails;
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
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    console.log("[targetdata-webhook] Payload received:", JSON.stringify(payload).slice(0, 500));

    // Accept both single record and array
    const records: any[] = Array.isArray(payload.data || payload.results || payload)
      ? (payload.data || payload.results || payload)
      : payload.data ? [payload.data] : [payload];

    const jobId = payload.job_id || payload.jobId || null;
    const tenantId = payload.tenant_id || payload.tenantId || null;

    let enrichedCount = 0;
    let failedCount = 0;

    for (const record of records) {
      const cpf = (record.cpf || record.documento || "").replace(/\D/g, "");
      if (!cpf) {
        failedCount++;
        continue;
      }

      const phones = extractPhones(record);
      const emails = extractEmails(record);
      const endereco = record.endereco || record.logradouro || null;
      const bairro = record.bairro || null;
      const cidade = record.cidade || record.municipio || null;
      const uf = record.uf || record.estado || null;
      const cep = record.cep ? String(record.cep).replace(/\D/g, "") : null;

      const updateData: Record<string, any> = {
        enrichment_data: record,
        updated_at: new Date().toISOString(),
      };

      if (phones.length > 0) updateData.phone = phones[0];
      if (phones.length > 1) updateData.phone2 = phones[1];
      if (phones.length > 2) updateData.phone3 = phones[2];
      if (emails.length > 0) updateData.email = emails[0];
      if (endereco) updateData.endereco = endereco;
      if (bairro) updateData.bairro = bairro;
      if (cidade) updateData.cidade = cidade;
      if (uf) updateData.uf = uf;
      if (cep) updateData.cep = cep;

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
