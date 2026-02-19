import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── SHA-256 helper ────────────────────────────────────────────────────────────
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Auth middleware ────────────────────────────────────────────────────────────
async function authenticate(req: Request): Promise<{ tenantId: string; keyId: string } | null> {
  const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
  if (!apiKey) return null;

  const hash = await sha256(apiKey);

  const { data: keyRow } = await supabaseAdmin
    .from("api_keys")
    .select("id, tenant_id, is_active")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle();

  if (!keyRow) return null;

  // Update last_used_at asynchronously (fire and forget)
  supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  return { tenantId: keyRow.tenant_id, keyId: keyRow.id };
}

// ── Field name normalization (accepts mailing format) ──────────────────────────
function normalizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const fieldMap: Record<string, string> = {
    "NOME_DEVEDOR": "nome_completo",
    "NOME DEVEDOR": "nome_completo",
    "NOME_COMPLETO": "nome_completo",
    "NOME COMPLETO": "nome_completo",
    "CNPJ_CPF": "cpf",
    "CREDOR": "credor",
    "COD_DEVEDOR": "external_id",
    "COD DEVEDOR": "external_id",
    "FONE_1": "phone",
    "FONE 1": "phone",
    "EMAIL": "email",
    "ENDERECO": "endereco_rua",
    "NUMERO": "endereco_num",
    "COMPLEMENTO": "endereco_comp",
    "BAIRRO": "endereco_bairro",
    "CIDADE": "cidade",
    "ESTADO": "uf",
    "UF": "uf",
    "CEP": "cep",
    "PARCELA": "numero_parcela",
    "DT_VENCIMENTO": "data_vencimento",
    "DT VENCIMENTO": "data_vencimento",
    "VL_TITULO": "vl_titulo",
    "VL TITULO": "vl_titulo",
    "VL_ATUALIZADO": "vl_atualizado",
    "VL ATUALIZADO": "vl_atualizado",
    "VL_SALDO": "vl_saldo",
    "STATUS": "status_mailing",
    "COD_CONTRATO": "cod_contrato",
    "COD CONTRATO": "cod_contrato",
    "FONE_2": "fone2",
    "FONE 2": "fone2",
    "FONE_3": "fone3",
    "FONE 3": "fone3",
    "TITULO": "titulo",
  };

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const mapped = fieldMap[key.toUpperCase().trim()] || key;
    // Don't overwrite if already set by a more specific field
    if (!(mapped in normalized)) {
      normalized[mapped] = value;
    }
  }

  // Concatenate address parts if present
  const addrParts = [
    normalized.endereco_rua, normalized.endereco_num,
    normalized.endereco_comp, normalized.endereco_bairro,
  ].filter(Boolean).map(String);
  if (addrParts.length > 0 && !normalized.endereco) {
    normalized.endereco = addrParts.join(", ");
  }
  delete normalized.endereco_rua;
  delete normalized.endereco_num;
  delete normalized.endereco_comp;
  delete normalized.endereco_bairro;

  // Prefer VL_ATUALIZADO over VL_TITULO for valor_parcela
  const vlAtualizado = Number(normalized.vl_atualizado ?? 0);
  const vlTitulo = Number(normalized.vl_titulo ?? 0);
  if (!normalized.valor_parcela) {
    normalized.valor_parcela = vlAtualizado > 0 ? vlAtualizado : vlTitulo;
  }
  if (!normalized.valor_entrada) {
    normalized.valor_entrada = normalized.valor_parcela;
  }
  delete normalized.vl_atualizado;
  delete normalized.vl_titulo;
  delete normalized.vl_saldo;

  // Map mailing status
  if (normalized.status_mailing && !normalized.status) {
    const raw = String(normalized.status_mailing).toUpperCase().trim();
    if (raw === "CANCELADO" || raw === "QUEBRADO") normalized.status = "quebrado";
    else if (raw === "PAGO") normalized.status = "pago";
    else normalized.status = "pendente";
  }
  delete normalized.status_mailing;

  // Build observacoes from extra fields
  const obsParts: string[] = [];
  if (normalized.cod_contrato) obsParts.push(`Contrato: ${normalized.cod_contrato}`);
  if (normalized.fone2) obsParts.push(`Fone 2: ${normalized.fone2}`);
  if (normalized.fone3) obsParts.push(`Fone 3: ${normalized.fone3}`);
  if (obsParts.length > 0 && !normalized.observacoes) {
    normalized.observacoes = obsParts.join(" | ");
  }
  delete normalized.cod_contrato;
  delete normalized.fone2;
  delete normalized.fone3;
  delete normalized.titulo;

  // Parse BR dates
  if (normalized.data_vencimento && typeof normalized.data_vencimento === "string") {
    const brMatch = (normalized.data_vencimento as string).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      normalized.data_vencimento = `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
    }
  }

  return normalized;
}

// ── Zod-like validation (native, no import) ───────────────────────────────────
type ValidationResult = { valid: boolean; errors: string[] };

function validateClientRecord(record: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  if (!record.nome_completo || typeof record.nome_completo !== "string" || (record.nome_completo as string).trim().length < 2) {
    errors.push("nome_completo: obrigatório (mínimo 2 caracteres)");
  }
  if (!record.cpf || typeof record.cpf !== "string") {
    errors.push("cpf: obrigatório");
  }
  if (!record.credor || typeof record.credor !== "string") {
    errors.push("credor: obrigatório");
  }
  if (record.numero_parcela !== undefined && (typeof record.numero_parcela !== "number" || !Number.isInteger(record.numero_parcela))) {
    errors.push("numero_parcela: deve ser um inteiro");
  }
  if (!record.valor_parcela || typeof record.valor_parcela !== "number" || record.valor_parcela < 0) {
    errors.push("valor_parcela: obrigatório e não-negativo");
  }
  if (record.data_vencimento && typeof record.data_vencimento === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.data_vencimento as string)) {
      errors.push("data_vencimento: formato inválido (esperado YYYY-MM-DD ou DD/MM/YYYY)");
    }
  } else {
    errors.push("data_vencimento: obrigatório");
  }
  if (record.status && !["pendente", "pago", "quebrado"].includes(record.status as string)) {
    errors.push("status: deve ser 'pendente', 'pago' ou 'quebrado'");
  }
  if (record.email && typeof record.email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email as string)) {
    errors.push("email: formato inválido");
  }

  return { valid: errors.length === 0, errors };
}

function buildClientRow(record: Record<string, unknown>, tenantId: string) {
  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    nome_completo: String(record.nome_completo ?? "").trim(),
    cpf: String(record.cpf ?? "").trim(),
    credor: String(record.credor ?? "").trim(),
    phone: record.phone ? String(record.phone).trim() : null,
    email: record.email ? String(record.email).trim() : null,
    external_id: record.external_id ? String(record.external_id).trim() : null,
    endereco: record.endereco ? String(record.endereco).trim() : null,
    cidade: record.cidade ? String(record.cidade).trim() : null,
    uf: record.uf ? String(record.uf).trim() : null,
    cep: record.cep ? String(record.cep).trim() : null,
    observacoes: record.observacoes ? String(record.observacoes).trim() : null,
    numero_parcela: Number(record.numero_parcela ?? 1),
    total_parcelas: Number(record.total_parcelas ?? 1),
    valor_entrada: Number(record.valor_entrada ?? 0),
    valor_parcela: Number(record.valor_parcela ?? 0),
    valor_pago: Number(record.valor_pago ?? 0),
    data_vencimento: String(record.data_vencimento),
    status: (record.status as string) || "pendente",
    updated_at: new Date().toISOString(),
  };
  if (record.status_cobranca_id && typeof record.status_cobranca_id === "string") {
    row.status_cobranca_id = record.status_cobranca_id.trim();
  }
  return row;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Strip all known path prefixes to get just the route segments
  const rawPath = url.pathname
    .replace(/^\/functions\/v1\/clients-api\/?/, "")
    .replace(/^\/clients-api\/?/, "")
    .replace(/^\//, "");
  const segments = rawPath.split("/").filter(Boolean);
  const method = req.method.toUpperCase();

  // ── Health ────────────────────────────────────────────────────────────────
  if (segments[0] === "health" && method === "GET") {
    return json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await authenticate(req);
  if (!auth) {
    return json({ error: "Unauthorized: X-API-Key inválida ou ausente" }, 401);
  }
  const { tenantId } = auth;

  // ── Routes ────────────────────────────────────────────────────────────────
  // GET /clients
  if (segments[0] === "clients" && !segments[1] && method === "GET") {
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
    const offset = (page - 1) * limit;
    const status = url.searchParams.get("status");
    const credor = url.searchParams.get("credor");
    const cpf = url.searchParams.get("cpf");

    let query = supabaseAdmin.from("clients").select("*", { count: "exact" }).eq("tenant_id", tenantId).range(offset, offset + limit - 1);
    if (status) query = query.eq("status", status);
    if (credor) query = query.ilike("credor", `%${credor}%`);
    if (cpf) query = query.eq("cpf", cpf);

    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ data, total: count, page, limit, pages: Math.ceil((count ?? 0) / limit) });
  }

  // GET /clients/:id
  if (segments[0] === "clients" && segments[1] && !segments[2] && method === "GET") {
    const { data, error } = await supabaseAdmin.from("clients").select("*").eq("id", segments[1]).eq("tenant_id", tenantId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Cliente não encontrado" }, 404);
    return json({ data });
  }

  // POST /clients (upsert único)
  if (segments[0] === "clients" && !segments[1] && method === "POST") {
    const rawBody = await req.json() as Record<string, unknown>;
    const body = normalizeRecord(rawBody);
    const { valid, errors } = validateClientRecord(body);
    if (!valid) return json({ error: "Validação falhou", errors }, 422);

    const row = buildClientRow(body, tenantId);

    // Upsert by external_id if provided, otherwise by cpf+numero_parcela
    let result;
    if (body.external_id) {
      result = await supabaseAdmin.from("clients").upsert(row, { onConflict: "external_id,tenant_id" }).select().single();
    } else {
      result = await supabaseAdmin.from("clients").upsert(row, { onConflict: "cpf,numero_parcela,tenant_id" }).select().single();
    }

    if (result.error) return json({ error: result.error.message }, 500);

    // Log single import
    supabaseAdmin.from("import_logs").insert({
      tenant_id: tenantId,
      api_key_id: auth.keyId,
      source: "api",
      total_records: 1,
      inserted: 1,
      credor: String(body.credor || ""),
    });

    return json({ success: true, data: result.data }, 201);
  }

  // POST /clients/bulk
  if (segments[0] === "clients" && segments[1] === "bulk" && method === "POST") {
    const rawBody = await req.json() as { records: Record<string, unknown>[]; upsert?: boolean; upsert_key?: string };

    if (!Array.isArray(rawBody.records) || rawBody.records.length === 0) {
      return json({ error: "'records' deve ser um array não vazio" }, 422);
    }
    if (rawBody.records.length > 500) {
      return json({ error: "Máximo de 500 registros por requisição bulk" }, 422);
    }

    const upsertKey = rawBody.upsert_key ?? "external_id";
    const doUpsert = rawBody.upsert !== false;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errorList: { index: number; external_id?: string; cpf?: string; error: string }[] = [];
    const validRows: ReturnType<typeof buildClientRow>[] = [];
    const validIndices: number[] = [];

    // Normalize + validate all records first
    rawBody.records.forEach((rawRecord, i) => {
      const record = normalizeRecord(rawRecord);
      const { valid, errors } = validateClientRecord(record);
      if (!valid) {
        errorList.push({ index: i, external_id: record.external_id as string, cpf: record.cpf as string, error: errors.join("; ") });
        skipped++;
      } else {
        validRows.push(buildClientRow(record, tenantId));
        validIndices.push(i);
      }
    });

    if (validRows.length > 0) {
      const conflictCol = upsertKey === "cpf" ? "cpf,numero_parcela,tenant_id" : "external_id,tenant_id";

      if (doUpsert) {
        const { data, error } = await supabaseAdmin
          .from("clients")
          .upsert(validRows, { onConflict: conflictCol })
          .select("id");

        if (error) {
          return json({ error: error.message }, 500);
        }
        inserted = data?.length ?? validRows.length;
      } else {
        const { data, error } = await supabaseAdmin.from("clients").insert(validRows).select("id");
        if (error) return json({ error: error.message }, 500);
        inserted = data?.length ?? validRows.length;
      }
    }

    // Detect credor from first record
    const firstNormalized = rawBody.records[0] ? normalizeRecord(rawBody.records[0]) : {};
    const credorName = String(firstNormalized.credor || "");

    // Log bulk import (fire and forget)
    supabaseAdmin.from("import_logs").insert({
      tenant_id: tenantId,
      api_key_id: auth.keyId,
      source: "api",
      total_records: rawBody.records.length,
      inserted,
      updated,
      skipped,
      errors: errorList.length > 0 ? errorList.slice(0, 20) : [],
      credor: credorName,
    });

    return json({
      success: true,
      inserted,
      updated,
      skipped,
      errors: errorList,
      total: rawBody.records.length,
    });
  }

  // PUT /clients/:id
  if (segments[0] === "clients" && segments[1] && !segments[2] && method === "PUT") {
    const body = await req.json() as Record<string, unknown>;
    const { error } = await supabaseAdmin
      .from("clients")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", segments[1])
      .eq("tenant_id", tenantId);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  // PUT /clients/by-external/:external_id
  if (segments[0] === "clients" && segments[1] === "by-external" && segments[2] && method === "PUT") {
    const body = await req.json() as Record<string, unknown>;
    const { error } = await supabaseAdmin
      .from("clients")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("external_id", segments[2])
      .eq("tenant_id", tenantId);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  // DELETE /clients/:id
  if (segments[0] === "clients" && segments[1] && !segments[2] && method === "DELETE") {
    const { error } = await supabaseAdmin.from("clients").delete().eq("id", segments[1]).eq("tenant_id", tenantId);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  // DELETE /clients/by-cpf/:cpf
  if (segments[0] === "clients" && segments[1] === "by-cpf" && segments[2] && method === "DELETE") {
    const { error } = await supabaseAdmin.from("clients").delete().eq("cpf", segments[2]).eq("tenant_id", tenantId);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true });
  }

  return json({ error: "Rota não encontrada" }, 404);
});
