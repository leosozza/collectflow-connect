import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COBCLOUD_BASE = "https://api-v3.cob.cloud";

interface CobCloudCredentials {
  tokenAssessoria: string;
  tokenClient: string;
  tenantId: string;
}

function buildCobCloudHeaders(creds: CobCloudCredentials) {
  return {
    token_company: creds.tokenAssessoria,
    token_client: creds.tokenClient,
    "Content-Type": "application/json",
  };
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function verifyAdminAndGetCredentials(req: Request): Promise<CobCloudCredentials> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Não autenticado");

  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Use getClaims for ES256 compatibility (Lovable Cloud)
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  
  let userId: string | null = null;
  
  if (claimsError || !claimsData?.claims) {
    // Fallback to getUser if getClaims is not available
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error("Auth error:", claimsError?.message || error?.message);
      throw new Error("Token inválido");
    }
    userId = user.id;
  } else {
    userId = claimsData.claims.sub as string;
  }

  if (!userId) throw new Error("Token inválido");

  const admin = getSupabaseAdmin();

  // Fetch profile with tenant_id and role
  const { data: profile } = await admin
    .from("profiles")
    .select("role, tenant_id")
    .eq("user_id", userId)
    .single();

  if (!profile || profile.role !== "admin") {
    throw new Error("Acesso restrito a administradores");
  }

  if (!profile.tenant_id) {
    throw new Error("Usuário sem empresa vinculada");
  }

  // Fetch tenant settings for credentials
  const { data: tenant } = await admin
    .from("tenants")
    .select("settings")
    .eq("id", profile.tenant_id)
    .single();

  const settings = tenant?.settings as Record<string, any> | null;
  const tokenAssessoria = settings?.cobcloud_token_company || settings?.cobcloud_token_assessoria || Deno.env.get("COBCLOUD_TOKEN_ASSESSORIA");
  const tokenClient = settings?.cobcloud_token_client || Deno.env.get("COBCLOUD_TOKEN_CLIENT");

  if (!tokenAssessoria || !tokenClient) {
    throw new Error("Credenciais CobCloud não configuradas");
  }

  return { tokenAssessoria, tokenClient, tenantId: profile.tenant_id };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return json({ error: message }, status);
}

// --- Validation schemas ---

const importedRecordSchema = z.object({
  nome_completo: z.string().trim().min(1).max(200),
  cpf: z.string().trim().min(1).max(20),
  credor: z.string().trim().min(1).max(100),
  numero_parcela: z.number().int().min(1).max(9999),
  valor_parcela: z.number().min(0).max(99999999.99),
  valor_pago: z.number().min(0).max(99999999.99),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["pendente", "pago", "quebrado"]),
});

const importRequestSchema = z.object({
  page: z.number().int().min(1).max(1000).optional().default(1),
  limit: z.number().int().min(1).max(500).optional().default(100),
  cpf: z.string().max(20).optional(),
  status: z.string().max(30).optional(),
});

const exportRequestSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(500),
});

const baixarRequestSchema = z.object({
  tituloId: z.string().min(1).max(100),
  valorPago: z.number().min(0).max(99999999.99).optional(),
  dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// --- Helpers ---

function sanitizeString(s: string, maxLen: number): string {
  return s.replace(/[<>"'&]/g, "").slice(0, maxLen).trim();
}

function cleanCpf(raw: string): string {
  return String(raw).replace(/\D/g, "").slice(0, 14);
}

function safeNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function mapStatus(s: string | undefined): "pendente" | "pago" | "quebrado" {
  if (!s) return "pendente";
  const lower = s.toLowerCase();
  if (lower.includes("pago") || lower.includes("quitado") || lower.includes("liquidado"))
    return "pago";
  if (lower.includes("quebr") || lower.includes("parcial")) return "quebrado";
  return "pendente";
}

// --- Helpers for batch processing ---

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { method: "GET", headers });
    if (res.status === 429) {
      console.warn(`Rate limited (429), retry ${attempt + 1}/${maxRetries}`);
      await delay(2000 * (attempt + 1));
      continue;
    }
    return res;
  }
  throw new Error("Rate limit excedido após múltiplas tentativas");
}

// --- Route handlers ---

async function handleStatus(creds: CobCloudCredentials) {
  try {
    const headers = buildCobCloudHeaders(creds);
    const res = await fetch(`${COBCLOUD_BASE}/cli/devedores/listar?page=1&limit=1`, {
      method: "GET",
      headers,
    });
    const ok = res.status === 200;
    return json({ connected: ok, status: res.status });
  } catch (e) {
    return json({ connected: false, error: e.message });
  }
}

async function handleImportTitulos(body: any, creds: CobCloudCredentials) {
  const headers = buildCobCloudHeaders(creds);
  const admin = getSupabaseAdmin();

  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Parâmetros inválidos: ${parsed.error.issues.map(i => i.message).join(", ")}`, 400);
  }
  const { page, limit, cpf, status } = parsed.data;

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  if (cpf) params.set("cpf", cpf);
  if (status) params.set("status", status);

  const res = await fetch(`${COBCLOUD_BASE}/cli/titulos/listar?${params}`, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    return errorResponse(`CobCloud retornou ${res.status}`, res.status);
  }

  const data = await res.json();
  const titulos = data.data || data.titulos || data || [];

  if (!Array.isArray(titulos) || titulos.length === 0) {
    return json({ imported: 0, message: "Nenhum título encontrado" });
  }

  if (titulos.length > 500) {
    return errorResponse("Resposta do CobCloud excede o limite de 500 registros", 400);
  }

  let imported = 0;
  let skipped = 0;

  for (const t of titulos) {
    const rawCpf = cleanCpf(t.cpf || t.documento || t.cpf_cnpj || "");
    if (!rawCpf) { skipped++; continue; }

    const rawRecord = {
      nome_completo: sanitizeString(String(t.nome || t.devedor_nome || t.nome_completo || "Sem nome"), 200),
      cpf: rawCpf,
      credor: sanitizeString(String(t.credor || t.empresa || "COBCLOUD"), 100),
      numero_parcela: Math.max(1, Math.min(9999, Math.round(safeNumber(t.parcela || t.numero_parcela, 1)))),
      valor_parcela: Math.max(0, Math.min(99999999.99, safeNumber(t.valor || t.valor_titulo || t.valor_parcela))),
      valor_pago: Math.max(0, Math.min(99999999.99, safeNumber(t.valor_pago))),
      data_vencimento: String(t.vencimento || t.data_vencimento || new Date().toISOString().split("T")[0]).slice(0, 10),
      status: mapStatus(t.status || t.situacao),
    };

    const validation = importedRecordSchema.safeParse(rawRecord);
    if (!validation.success) {
      console.warn(`Skipping invalid record (CPF: ${rawCpf}): ${validation.error.message}`);
      skipped++;
      continue;
    }

    const rec = validation.data;
    const { data: existing } = await admin
      .from("clients")
      .select("id")
      .eq("cpf", rec.cpf)
      .eq("numero_parcela", rec.numero_parcela)
      .eq("tenant_id", creds.tenantId)
      .maybeSingle();

    if (existing) {
      await admin.from("clients").update(rec).eq("id", existing.id);
    } else {
      await admin.from("clients").insert({ ...rec, tenant_id: creds.tenantId });
    }
    imported++;
  }

  return json({ imported, skipped, total: titulos.length });
}

async function handleExportDevedores(body: any, creds: CobCloudCredentials) {
  const headers = buildCobCloudHeaders(creds);
  const admin = getSupabaseAdmin();

  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Parâmetros inválidos: ${parsed.error.issues.map(i => i.message).join(", ")}`, 400);
  }
  const clientIds = parsed.data.clientIds;

  const { data: clients, error } = await admin
    .from("clients")
    .select("*")
    .in("id", clientIds)
    .eq("tenant_id", creds.tenantId);

  if (error) return errorResponse(error.message);
  if (!clients || clients.length === 0) return errorResponse("Clientes não encontrados");

  const grouped: Record<string, any[]> = {};
  for (const c of clients) {
    if (!grouped[c.cpf]) grouped[c.cpf] = [];
    grouped[c.cpf].push(c);
  }

  const results: any[] = [];
  for (const [cpf, titles] of Object.entries(grouped)) {
    const first = titles[0];
    const payload = {
      nome: first.nome_completo,
      cpf: cpf,
      titulos: titles.map((t: any) => ({
        valor: t.valor_parcela,
        vencimento: t.data_vencimento,
        parcela: t.numero_parcela,
      })),
    };

    try {
      const res = await fetch(`${COBCLOUD_BASE}/cli/devedores/cadastrar`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const resData = await res.json();
      results.push({ cpf, status: res.status, response: resData });
    } catch (e) {
      results.push({ cpf, status: 500, error: e.message });
    }
  }

  return json({ sent: Object.keys(grouped).length, results });
}

async function handleBaixarTitulo(body: any, creds: CobCloudCredentials) {
  const headers = buildCobCloudHeaders(creds);

  const parsed = baixarRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Parâmetros inválidos: ${parsed.error.issues.map(i => i.message).join(", ")}`, 400);
  }
  const { tituloId, valorPago, dataPagamento } = parsed.data;

  const payload: Record<string, unknown> = { id: tituloId };
  if (valorPago != null) payload.valor_pago = valorPago;
  if (dataPagamento) payload.data_pagamento = dataPagamento;

  const res = await fetch(`${COBCLOUD_BASE}/cli/titulos/baixar`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  return json({ status: res.status, data });
}

async function handleImportAll(body: any, creds: CobCloudCredentials) {
  const headers = buildCobCloudHeaders(creds);
  const admin = getSupabaseAdmin();

  const MAX_PAGES = 50;
  const PAGE_SIZE = 200;
  const DELAY_MS = 500;

  const cpfFilter = body.cpf ? String(body.cpf).slice(0, 20) : undefined;
  const statusFilter = body.status ? String(body.status).slice(0, 30) : undefined;

  let page = 1;
  let totalImported = 0;
  let totalSkipped = 0;
  let totalRecords = 0;

  while (page <= MAX_PAGES) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (cpfFilter) params.set("cpf", cpfFilter);
    if (statusFilter) params.set("status", statusFilter);

    let res: Response;
    try {
      res = await fetchWithRetry(`${COBCLOUD_BASE}/cli/titulos/listar?${params}`, headers);
    } catch (e) {
      console.error(`Page ${page} fetch failed:`, e.message);
      break;
    }

    if (!res.ok) {
      console.error(`CobCloud returned ${res.status} on page ${page}`);
      break;
    }

    const data = await res.json();
    const titulos = data.data || data.titulos || data || [];

    if (!Array.isArray(titulos) || titulos.length === 0) break;

    for (const t of titulos) {
      const rawCpf = cleanCpf(t.cpf || t.documento || t.cpf_cnpj || "");
      if (!rawCpf) { totalSkipped++; continue; }

      const rawRecord = {
        nome_completo: sanitizeString(String(t.nome || t.devedor_nome || t.nome_completo || "Sem nome"), 200),
        cpf: rawCpf,
        credor: sanitizeString(String(t.credor || t.empresa || "COBCLOUD"), 100),
        numero_parcela: Math.max(1, Math.min(9999, Math.round(safeNumber(t.parcela || t.numero_parcela, 1)))),
        valor_parcela: Math.max(0, Math.min(99999999.99, safeNumber(t.valor || t.valor_titulo || t.valor_parcela))),
        valor_pago: Math.max(0, Math.min(99999999.99, safeNumber(t.valor_pago))),
        data_vencimento: String(t.vencimento || t.data_vencimento || new Date().toISOString().split("T")[0]).slice(0, 10),
        status: mapStatus(t.status || t.situacao),
      };

      const validation = importedRecordSchema.safeParse(rawRecord);
      if (!validation.success) { totalSkipped++; continue; }

      const rec = validation.data;
      const { data: existing } = await admin
        .from("clients")
        .select("id")
        .eq("cpf", rec.cpf)
        .eq("numero_parcela", rec.numero_parcela)
        .eq("tenant_id", creds.tenantId)
        .maybeSingle();

      if (existing) {
        await admin.from("clients").update(rec).eq("id", existing.id);
      } else {
        await admin.from("clients").insert({ ...rec, tenant_id: creds.tenantId });
      }
      totalImported++;
    }

    totalRecords += titulos.length;
    console.log(`Page ${page}: ${titulos.length} records, total imported so far: ${totalImported}`);

    if (titulos.length < PAGE_SIZE) break;
    page++;
    await delay(DELAY_MS);
  }

  return json({ imported: totalImported, skipped: totalSkipped, pages: page, total: totalRecords });
}

// --- Main handler ---


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // All routes require admin auth + tenant credentials
    const creds = await verifyAdminAndGetCredentials(req);

    const body = req.method !== "GET" ? await req.json() : {};
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";
    const action = body.action || path;

    switch (action) {
      case "status":
      case "cobcloud-proxy":
        return await handleStatus(creds);
      case "import-titulos":
        return await handleImportTitulos(body, creds);
      case "import-all":
        return await handleImportAll(body, creds);
      case "export-devedores":
        return await handleExportDevedores(body, creds);
      case "baixar-titulo":
        return await handleBaixarTitulo(body, creds);
      default:
        return errorResponse(`Ação desconhecida: ${action}`, 404);
    }
  } catch (e) {
    console.error("cobcloud-proxy error:", e);
    const safeMessages = ["Não autenticado", "Token inválido", "Acesso restrito a administradores", "Credenciais CobCloud não configuradas", "Usuário sem empresa vinculada"];
    const msg = safeMessages.includes(e.message) ? e.message : "Erro interno do servidor";
    return errorResponse(msg, e.message === "Não autenticado" || e.message === "Token inválido" ? 401 : 500);
  }
});
