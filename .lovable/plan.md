# Rebranding "CollectFlow" → "Rivo Connect" + MCP na doc pública

## 1. Substituir "CollectFlow" remanescente por "Rivo Connect"

Ocorrências encontradas no código (fora de migrations já aplicadas):

- `src/pages/TenantSettingsPage.tsx` (linhas 27 e 30) — texto do contrato:
  - "CollectFlow Connect - Plataforma SaaS..." → "Rivo Connect - Plataforma SaaS..."
  - "software CollectFlow Connect, plataforma SaaS..." → "software Rivo Connect, plataforma SaaS..."
- `src/components/contact-center/threecplus/AgentDetailSheet.tsx` (linha 386):
  - "...corresponder ao nome completo do perfil no CollectFlow." → "...no Rivo Connect."
- `supabase/functions/threecplus-proxy/index.ts` (linha 126) — nome default de campanha 3CPlus:
  - `` `CollectFlow ${data}` `` → `` `Rivo Connect ${data}` ``

Não alterar:
- `supabase/migrations/20260211145726_*.sql` — migration histórica já aplicada (nome de seed). Renomear via nova migration UPDATE no registro `'CollectFlow Default'` em `payment_gateways` (ou tabela equivalente) caso ainda exista no banco — confirmar e aplicar UPDATE pontual.

## 2. Incluir o MCP na documentação pública (`/api-docs/public`)

Hoje `ApiDocsPublicPage.tsx` é uma página única (REST). O componente `McpServerTab` já existe e aceita `publicView`.

Mudanças em `src/pages/ApiDocsPublicPage.tsx`:
- Envolver o conteúdo principal em `<Tabs defaultValue="rest">` com duas abas:
  - **REST API** (conteúdo atual)
  - **MCP Server** → renderiza `<McpServerTab publicView />`
- TabsList logo abaixo do header, dentro do `<main>`, sticky-friendly.
- Header continua "RIVO CONNECT API" — adicionar subtítulo "REST + MCP".

Mudanças em `src/pages/ApiDocsPage.tsx` (interna): garantir mesma estrutura de abas se ainda não tiver MCP visível (verificar e alinhar — tela interna `/configuracoes/api` já tem aba separada `/configuracoes/mcp`, então manter como está).

## Arquivos editados

- `src/pages/ApiDocsPublicPage.tsx` — adicionar Tabs com REST + MCP
- `src/pages/TenantSettingsPage.tsx` — texto do contrato
- `src/components/contact-center/threecplus/AgentDetailSheet.tsx` — hint do agente
- `supabase/functions/threecplus-proxy/index.ts` — nome default de campanha
- Nova migration SQL para UPDATE de `'CollectFlow Default'` → `'Rivo Connect Default'` (se o registro ainda existir)

Sem mudanças em schema, RLS, edge auth ou `McpServerTab.tsx` (já está pronto para `publicView`).
