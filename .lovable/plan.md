# MCP Server — RIVO CONNECT

Criar um servidor **MCP (Model Context Protocol)** hospedado como Edge Function que expõe as funcionalidades da API REST do RIVO CONNECT como **tools**, permitindo que CRMs externos (HubSpot, Pipedrive, Salesforce, etc.) e agentes de IA (Claude, ChatGPT, n8n, Zapier AI) consultem e operem dados do RIVO de forma padronizada.

## Por que MCP

A API REST atual (`/clients-api`) já cobre clientes, acordos, pagamentos, portal e WhatsApp. Um servidor MCP **encapsula esses endpoints como tools auto-descritivas**, eliminando a necessidade de cada CRM implementar um cliente HTTP customizado — basta apontar o MCP URL + API Key.

## Arquitetura

```text
CRM Externo / Agente IA
        │
        │ MCP Streamable HTTP
        │ Header: X-API-Key: rivo_xxx
        ▼
Edge Function: mcp-server
        │ (mcp-lite + Hono)
        │
        ├── Autentica via api_keys (SHA-256, mesmo schema atual)
        ├── Resolve tenant_id
        └── Invoca clients-api internamente OU consulta DB direto
                │
                ▼
        Supabase (RLS por tenant_id)
```

## Componentes

### 1. Nova Edge Function `supabase/functions/mcp-server/index.ts`
- Usa **mcp-lite** (npm:mcp-lite@^0.10.0) + **Hono** + `StreamableHttpTransport`
- `verify_jwt = false` em `supabase/config.toml` (auth via X-API-Key)
- Reaproveita a mesma tabela `api_keys` (SHA-256) — nenhum schema novo necessário
- Endpoint público: `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/mcp-server`

### 2. Tools expostas (mapeadas 1:1 com a API REST)

**Clientes / Carteira**
- `list_clients` — filtros: status, credor, cpf, limit, offset
- `get_client` — por id ou cpf
- `create_client` — payload completo (nome, cpf, credor, dívida)
- `update_client_status` — muda status (INADIMPLENTE → EM DIA, etc.)
- `bulk_import_clients` — array de até 1000 registros

**Acordos**
- `list_agreements` — filtros: status, cpf, credor
- `get_agreement` — por id
- `create_agreement` — valor, parcelas, data
- `approve_agreement` / `reject_agreement`

**Pagamentos**
- `list_payments` — por agreement_id ou período
- `generate_pix` / `generate_boleto` — para uma parcela
- `confirm_manual_payment` — admin

**Portal do Devedor**
- `lookup_debtor` — por CPF (gera link checkout)
- `create_portal_agreement` — proposta self-service

**Comunicação**
- `send_whatsapp` — mensagem unitária
- `send_whatsapp_bulk` — campanha
- `register_webhook` — CRM externo recebe eventos (acordo criado, pagamento confirmado)

**Metadados**
- `list_credores`
- `list_status_types`
- `calculate_propensity` — score de propensão por CPF

### 3. Documentação
- Nova aba **"MCP Server"** em `src/pages/ApiDocsPublicPage.tsx` e `ApiDocsPage.tsx` com:
  - URL do servidor MCP
  - Como gerar API Key (link p/ Configurações → API REST — reaproveita fluxo existente)
  - Snippets de configuração para: **Claude Desktop**, **Cursor**, **n8n MCP node**, **VS Code (Continue)**, **ChatGPT custom GPT**
  - Lista completa das tools com input schema

### 4. Atualização do menu Configurações
- `src/pages/ConfiguracoesPage.tsx` — card "Servidor MCP" ao lado de "API REST"
- Rota `/configuracoes/mcp` reutilizando `ApiDocsPage` com tab inicial `mcp`

## Detalhes técnicos

**Auth pattern (idêntico ao clients-api)**
```ts
const apiKey = req.headers.get("x-api-key");
const hash = await sha256(apiKey);
const { data } = await supabase.from("api_keys")
  .select("tenant_id").eq("key_hash", hash).eq("is_active", true).single();
```

**Tool handler pattern (mcp-lite)**
```ts
mcpServer.tool({
  name: "list_clients",
  description: "Lista clientes/devedores do tenant. Use para sincronizar com CRM externo.",
  inputSchema: { type: "object", properties: {
    status: { type: "string", enum: ["INADIMPLENTE","EM DIA","ACORDO VIGENTE","QUITADO"] },
    credor: { type: "string" },
    limit: { type: "number", default: 100, maximum: 1000 }
  }},
  handler: async (input, ctx) => {
    const tenantId = ctx.auth.tenantId; // injetado no transport
    const { data } = await supabase.from("clients")
      .select("*").eq("tenant_id", tenantId)
      .eq("status", input.status).limit(input.limit);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
});
```

**Tenant isolation**: cada tool obrigatoriamente injeta `.eq('tenant_id', tenantId)` — segue regra Core de RLS.

**Rate limiting**: contagem in-memory por `key_hash` (60 req/min) para evitar abuso. Documentar na página pública.

**Logging**: cada chamada MCP grava em `webhook_logs` com `source='mcp'`, `tool_name`, `tenant_id` para auditoria.

## Arquivos a criar/editar

**Criar**
- `supabase/functions/mcp-server/index.ts` — servidor MCP completo
- `supabase/functions/mcp-server/deno.json` — import map com `mcp-lite`
- `src/components/api-docs/McpServerTab.tsx` — UI da documentação MCP

**Editar**
- `supabase/config.toml` — adicionar bloco `[functions.mcp-server]` com `verify_jwt = false`
- `src/pages/ApiDocsPublicPage.tsx` — adicionar tab "MCP Server"
- `src/pages/ApiDocsPage.tsx` — adicionar tab "MCP Server"
- `src/pages/ConfiguracoesPage.tsx` — card MCP
- `src/App.tsx` — rota `/configuracoes/mcp` (e `/api-docs/public` já existente passa a ter anchor `#mcp`)

## Não escopo (fica para depois)
- Implementar MCP **client** dentro do RIVO (consumir CRMs externos via MCP) — este plano só expõe o RIVO **como servidor**.
- Tools de escrita destrutiva em massa (delete bulk) — mantidas só na API REST por segurança.

Confirmar para implementar?
