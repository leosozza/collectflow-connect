import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COBCLOUD_BASE = "https://api-v3.cob.cloud";

function getCobCloudHeaders() {
  const tokenAssessoria = Deno.env.get("COBCLOUD_TOKEN_ASSESSORIA");
  const tokenClient = Deno.env.get("COBCLOUD_TOKEN_CLIENT");
  if (!tokenAssessoria || !tokenClient) {
    throw new Error("Credenciais CobCloud não configuradas");
  }
  return {
    token_assessoria: tokenAssessoria,
    token_client: tokenClient,
    "Content-Type": "application/json",
  };
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Não autenticado");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Token inválido");

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    throw new Error("Acesso restrito a administradores");
  }

  return user;
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

// --- Route handlers ---

async function handleStatus() {
  try {
    const headers = getCobCloudHeaders();
    const res = await fetch(`${COBCLOUD_BASE}/cli/titulos/listar?page=1&limit=1`, {
      method: "GET",
      headers,
    });
    const ok = res.status === 200;
    return json({ connected: ok, status: res.status });
  } catch (e) {
    return json({ connected: false, error: e.message });
  }
}

// Validation schemas for imported data
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

async function handleImportTitulos(body: any) {
  const headers = getCobCloudHeaders();
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
      .maybeSingle();

    if (existing) {
      await admin.from("clients").update(rec).eq("id", existing.id);
    } else {
      await admin.from("clients").insert(rec);
    }
    imported++;
  }

  return json({ imported, skipped, total: titulos.length });
}

async function handleExportDevedores(body: any) {
  const headers = getCobCloudHeaders();
  const admin = getSupabaseAdmin();

  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(`Parâmetros inválidos: ${parsed.error.issues.map(i => i.message).join(", ")}`, 400);
  }
  const clientIds = parsed.data.clientIds;

  const { data: clients, error } = await admin
    .from("clients")
    .select("*")
    .in("id", clientIds);

  if (error) return errorResponse(error.message);
  if (!clients || clients.length === 0) return errorResponse("Clientes não encontrados");

  // Group by CPF (one devedor can have multiple titles)
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

async function handleBaixarTitulo(body: any) {
  const headers = getCobCloudHeaders();

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

function mapStatus(s: string | undefined): "pendente" | "pago" | "quebrado" {
  if (!s) return "pendente";
  const lower = s.toLowerCase();
  if (lower.includes("pago") || lower.includes("quitado") || lower.includes("liquidado"))
    return "pago";
  if (lower.includes("quebr") || lower.includes("parcial")) return "quebrado";
  return "pendente";
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    // Status endpoint doesn't need admin (but needs auth)
    if (path === "status" || path === "cobcloud-proxy") {
      if (req.method === "GET" || (req.method === "POST" && path === "cobcloud-proxy")) {
        // For GET /status, verify auth
        await verifyAdmin(req);

        if (req.method === "GET" || path === "status") {
          return await handleStatus();
        }
      }
    }

    // All POST routes require admin
    await verifyAdmin(req);

    const body = req.method !== "GET" ? await req.json() : {};
    const action = body.action || path;

    switch (action) {
      case "status":
        return await handleStatus();
      case "import-titulos":
        return await handleImportTitulos(body);
      case "export-devedores":
        return await handleExportDevedores(body);
      case "baixar-titulo":
        return await handleBaixarTitulo(body);
      default:
        return errorResponse(`Ação desconhecida: ${action}`, 404);
    }
  } catch (e) {
    console.error("cobcloud-proxy error:", e);
    const safeMessages = ["Não autenticado", "Token inválido", "Acesso restrito a administradores", "Credenciais CobCloud não configuradas"];
    const msg = safeMessages.includes(e.message) ? e.message : "Erro interno do servidor";
    return errorResponse(msg, e.message === "Não autenticado" || e.message === "Token inválido" ? 401 : 500);
  }
});
