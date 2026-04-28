// MCP Server (Model Context Protocol) — RIVO CONNECT
// Exposes RIVO data and operations as tools for external CRMs and AI agents.
// Auth: same X-API-Key (SHA-256) used by clients-api.
// Transport: MCP Streamable HTTP via mcp-lite + Hono.

import { Hono } from "npm:hono@4.6.14";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── SHA-256 ──────────────────────────────────────────────────────────────────
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function resolveTenant(apiKey: string | null): Promise<string | null> {
  if (!apiKey) return null;
  const hash = await sha256(apiKey);
  const { data } = await supabase
    .from("api_keys")
    .select("id, tenant_id, is_active")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  // fire-and-forget last_used update
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.tenant_id as string;
}

// ── Tool result helper ──────────────────────────────────────────────────────
const ok = (payload: unknown) => ({
  content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }],
});
const fail = (msg: string) => ({
  isError: true,
  content: [{ type: "text", text: msg }],
});

// ── Build per-request MCP server (so we can capture tenantId in closures) ───
function buildServer(tenantId: string) {
  const server = new McpServer({
    name: "rivo-connect-mcp",
    version: "1.0.0",
  });

  // ── CLIENTS ──────────────────────────────────────────────────────────────
  server.tool({
    name: "list_clients",
    description: "Lista clientes/devedores da carteira. Filtros opcionais por status, credor e CPF. Use para sincronizar com CRMs externos.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtrar por status (INADIMPLENTE, EM DIA, ACORDO VIGENTE, QUITADO, etc.)" },
        credor: { type: "string", description: "Nome (parcial) do credor" },
        cpf: { type: "string", description: "CPF exato (apenas dígitos)" },
        limit: { type: "number", default: 100, maximum: 500 },
        page: { type: "number", default: 1 },
      },
    },
    handler: async (input: any) => {
      const limit = Math.min(input?.limit ?? 100, 500);
      const page = input?.page ?? 1;
      const offset = (page - 1) * limit;
      let q = supabase.from("clients").select("*", { count: "exact" })
        .eq("tenant_id", tenantId).range(offset, offset + limit - 1);
      if (input?.status) q = q.eq("status", input.status);
      if (input?.credor) q = q.ilike("credor", `%${input.credor}%`);
      if (input?.cpf) q = q.eq("cpf", input.cpf);
      const { data, error, count } = await q;
      if (error) return fail(error.message);
      return ok({ data, total: count, page, limit });
    },
  });

  server.tool({
    name: "get_client",
    description: "Busca um cliente por id (UUID) ou CPF.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID do cliente" },
        cpf: { type: "string", description: "CPF (apenas dígitos)" },
      },
    },
    handler: async (input: any) => {
      if (!input?.id && !input?.cpf) return fail("Informe id ou cpf");
      let q = supabase.from("clients").select("*").eq("tenant_id", tenantId).limit(10);
      if (input.id) q = q.eq("id", input.id);
      else q = q.eq("cpf", input.cpf);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok({ data });
    },
  });

  server.tool({
    name: "create_client",
    description: "Cria ou atualiza (upsert) um cliente. Conflito por external_id+tenant ou cpf+numero_parcela+tenant.",
    inputSchema: {
      type: "object",
      required: ["nome_completo", "cpf", "credor"],
      properties: {
        nome_completo: { type: "string" },
        cpf: { type: "string" },
        credor: { type: "string" },
        external_id: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        vl_titulo: { type: "number" },
        vl_atualizado: { type: "number" },
        data_vencimento: { type: "string", description: "ISO date" },
        numero_parcela: { type: "string" },
      },
    },
    handler: async (input: any) => {
      const row = { ...input, tenant_id: tenantId, updated_at: new Date().toISOString() };
      const onConflict = input.external_id ? "external_id,tenant_id" : "cpf,numero_parcela,tenant_id";
      const { data, error } = await supabase.from("clients").upsert(row, { onConflict }).select().single();
      if (error) return fail(error.message);
      return ok({ success: true, data });
    },
  });

  server.tool({
    name: "update_client_status",
    description: "Atualiza o status de cobrança de um cliente.",
    inputSchema: {
      type: "object",
      required: ["id", "status_cobranca_id"],
      properties: {
        id: { type: "string" },
        status_cobranca_id: { type: "string" },
      },
    },
    handler: async (input: any) => {
      const { error } = await supabase.from("clients")
        .update({ status_cobranca_id: input.status_cobranca_id, updated_at: new Date().toISOString() })
        .eq("id", input.id).eq("tenant_id", tenantId);
      if (error) return fail(error.message);
      return ok({ success: true });
    },
  });

  // ── AGREEMENTS ───────────────────────────────────────────────────────────
  server.tool({
    name: "list_agreements",
    description: "Lista acordos comerciais. Filtros por status, cpf, credor.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        cpf: { type: "string" },
        credor: { type: "string" },
        limit: { type: "number", default: 50, maximum: 200 },
        page: { type: "number", default: 1 },
      },
    },
    handler: async (input: any) => {
      const limit = Math.min(input?.limit ?? 50, 200);
      const page = input?.page ?? 1;
      const offset = (page - 1) * limit;
      let q = supabase.from("agreements").select("*", { count: "exact" })
        .eq("tenant_id", tenantId).order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (input?.status) q = q.eq("status", input.status);
      if (input?.cpf) q = q.eq("client_cpf", input.cpf);
      if (input?.credor) q = q.ilike("credor", `%${input.credor}%`);
      const { data, error, count } = await q;
      if (error) return fail(error.message);
      return ok({ data, total: count, page, limit });
    },
  });

  server.tool({
    name: "get_agreement",
    description: "Busca um acordo por id (UUID), incluindo parcelas.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
    handler: async (input: any) => {
      const { data, error } = await supabase.from("agreements").select("*, agreement_installments(*)")
        .eq("id", input.id).eq("tenant_id", tenantId).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Acordo não encontrado");
      return ok({ data });
    },
  });

  // ── PAYMENTS ─────────────────────────────────────────────────────────────
  server.tool({
    name: "list_payments",
    description: "Lista pagamentos de um acordo ou em um período.",
    inputSchema: {
      type: "object",
      properties: {
        agreement_id: { type: "string" },
        from: { type: "string", description: "ISO date inicial" },
        to: { type: "string", description: "ISO date final" },
        limit: { type: "number", default: 100, maximum: 500 },
      },
    },
    handler: async (input: any) => {
      let q = supabase.from("agreement_installments").select("*").eq("tenant_id", tenantId)
        .order("due_date", { ascending: false }).limit(Math.min(input?.limit ?? 100, 500));
      if (input?.agreement_id) q = q.eq("agreement_id", input.agreement_id);
      if (input?.from) q = q.gte("paid_at", input.from);
      if (input?.to) q = q.lte("paid_at", input.to);
      const { data, error } = await q;
      if (error) return fail(error.message);
      return ok({ data });
    },
  });

  // ── PORTAL ───────────────────────────────────────────────────────────────
  server.tool({
    name: "lookup_debtor",
    description: "Consulta dívidas de um devedor por CPF e gera link público do portal de negociação.",
    inputSchema: {
      type: "object",
      required: ["cpf"],
      properties: { cpf: { type: "string" } },
    },
    handler: async (input: any) => {
      const { data, error } = await supabase.from("clients")
        .select("id, nome_completo, cpf, credor, vl_atualizado, data_vencimento, status")
        .eq("tenant_id", tenantId).eq("cpf", input.cpf);
      if (error) return fail(error.message);
      const portalUrl = `https://rivoconnect.com/portal?cpf=${encodeURIComponent(input.cpf)}`;
      return ok({ debts: data, portal_url: portalUrl });
    },
  });

  // ── METADATA ─────────────────────────────────────────────────────────────
  server.tool({
    name: "list_credores",
    description: "Lista credores cadastrados no tenant.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const { data, error } = await supabase.from("credores").select("*")
        .eq("tenant_id", tenantId).order("nome");
      if (error) return fail(error.message);
      return ok({ data });
    },
  });

  server.tool({
    name: "list_status_types",
    description: "Lista os tipos de status de cobrança disponíveis no tenant.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const { data, error } = await supabase.from("status_cobranca").select("*")
        .eq("tenant_id", tenantId).order("ordem", { ascending: true });
      if (error) return fail(error.message);
      return ok({ data });
    },
  });

  server.tool({
    name: "calculate_propensity",
    description: "Calcula (ou retorna cache) score de propensão de pagamento de um CPF (0-100).",
    inputSchema: {
      type: "object",
      required: ["cpf"],
      properties: { cpf: { type: "string" } },
    },
    handler: async (input: any) => {
      try {
        const { data, error } = await supabase.functions.invoke("calculate-propensity", {
          body: { cpf: input.cpf, tenant_id: tenantId },
        });
        if (error) return fail(error.message);
        return ok(data);
      } catch (e) {
        return fail(String(e));
      }
    },
  });

  // ── COMMUNICATION ────────────────────────────────────────────────────────
  server.tool({
    name: "send_whatsapp",
    description: "Envia uma mensagem WhatsApp unitária para um número (E.164 sem +).",
    inputSchema: {
      type: "object",
      required: ["phone", "message"],
      properties: {
        phone: { type: "string", description: "Número E.164: 55DDD9XXXXXXXX" },
        message: { type: "string" },
        instance_id: { type: "string", description: "(Opcional) UUID da instância de envio" },
      },
    },
    handler: async (input: any) => {
      try {
        const { data, error } = await supabase.functions.invoke("send-chat-message", {
          body: { tenant_id: tenantId, phone: input.phone, content: input.message, instance_id: input.instance_id },
        });
        if (error) return fail(error.message);
        return ok(data);
      } catch (e) {
        return fail(String(e));
      }
    },
  });

  // ── EVENTS ───────────────────────────────────────────────────────────────
  server.tool({
    name: "get_client_timeline",
    description: "Retorna a timeline omnichannel de um cliente (events de WhatsApp, telefone, e-mail, ações).",
    inputSchema: {
      type: "object",
      required: ["cpf"],
      properties: {
        cpf: { type: "string" },
        limit: { type: "number", default: 100, maximum: 500 },
      },
    },
    handler: async (input: any) => {
      const { data, error } = await supabase.from("client_events")
        .select("*").eq("tenant_id", tenantId).eq("client_cpf", input.cpf)
        .order("created_at", { ascending: false })
        .limit(Math.min(input?.limit ?? 100, 500));
      if (error) return fail(error.message);
      return ok({ data });
    },
  });

  return server;
}

// ── HTTP entrypoint ──────────────────────────────────────────────────────────
const app = new Hono();

app.options("*", (c) => new Response(null, { headers: corsHeaders }));

app.get("/", (c) =>
  new Response(
    JSON.stringify({
      name: "RIVO CONNECT MCP Server",
      version: "1.0.0",
      transport: "streamable-http",
      auth: "Header X-API-Key (gerado em Configurações → API REST)",
      docs: "https://rivoconnect.com/api-docs/public",
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
);

app.all("/*", async (c) => {
  // Strip Supabase function path prefix when invoked publicly
  const apiKey = c.req.header("x-api-key") || c.req.header("X-API-Key");
  const tenantId = await resolveTenant(apiKey ?? null);
  if (!tenantId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: header X-API-Key inválido ou ausente" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const server = buildServer(tenantId);
  const transport = new StreamableHttpTransport();
  const response = await transport.handleRequest(c.req.raw, server);

  // Inject CORS headers in MCP response
  const merged = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) merged.set(k, v);
  return new Response(response.body, { status: response.status, headers: merged });
});

Deno.serve(app.fetch);
