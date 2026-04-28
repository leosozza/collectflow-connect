# Atualização da Documentação API — RIVO CONNECT

A documentação atual (`/api-docs/public` e a aba "API REST" em Configurações) ainda está marcada como **"CollectFlow API"** com cor azul hard-coded e referencia a URL antiga. Os endpoints em si estão corretos e batem com a edge function `clients-api`. As mudanças são de **branding, URL pública e tokens semânticos**.

## O que será alterado

### 1. `src/pages/ApiDocsPublicPage.tsx` (página pública — `/api-docs/public`)

**Branding:**
- "CollectFlow API" → **"RIVO CONNECT API"** (header).
- Subtítulo: "REST API completa para gestão de cobranças" → "REST API completa para gestão de cobranças e omnichannel".
- Rodapé: remover menção a "CollectFlow", trocar por "RIVO CONNECT • Para obter sua chave de API, solicite ao administrador do seu tenant em **Configurações → API REST**".
- Adicionar `© RIVO CONNECT` no rodapé.

**URL pública canônica:**
- Adicionar no card "URL Base" uma linha exibindo a URL pública oficial: `https://rivoconnect.com/api-docs/public`.

**Cores (semantic tokens em vez de azul hard-coded):**
- `bg-blue-600` → `bg-primary` (laranja da marca)
- `text-blue-600`, `border-blue-500/30`, `bg-blue-50/50 dark:bg-blue-950/20` → tokens `primary`/`primary/10`/`primary/20`
- `bg-white dark:bg-zinc-950` → `bg-background`
- `text-zinc-900 dark:text-zinc-100` → `text-foreground`
- `text-zinc-500`, `text-zinc-400` → `text-muted-foreground`
- `border-zinc-200 dark:border-zinc-800` → `border-border`
- `bg-zinc-50 dark:bg-zinc-900` (rodapé) → `bg-muted/30`
- Badges de método HTTP no `EndpointRow`: substituir `text-blue-600` (GET) por `text-primary`, manter green/amber/red para POST/PUT/DELETE mas usando tokens (`text-emerald-600`, `text-amber-600`, `text-destructive`).

**Conteúdo dos endpoints:** mantido (já validado contra `supabase/functions/clients-api/index.ts` linhas 251–780 — Health, Clients CRUD + bulk, Agreements, Payments, Portal, Cadastros, WhatsApp, Webhooks, Propensity, Status types, Credores).

**Pequenos ajustes textuais:**
- Trocar `bg-zinc-100 dark:bg-zinc-800` (chips de campo na tabela "Campos aceitos") por `bg-muted`.
- Bloco "Rate Limits" no fim: trocar `bg-zinc-100 dark:bg-zinc-800` por `bg-muted`.

### 2. `src/pages/ApiDocsPage.tsx` (área autenticada — `Configurações → API REST`)

**Branding:**
- "Integre sistemas externos com toda a plataforma **CollectFlow**" → "Integre sistemas externos com toda a plataforma **RIVO CONNECT**".

**URL pública:**
- A variável `publicUrl` continua sendo `${window.location.origin}/api-docs/public` (já correto após o fix anterior). Adicionar um helper visual mostrando a URL canônica de produção `https://rivoconnect.com/api-docs/public` quando o `window.location.origin` for um preview/sandbox, para o admin compartilhar o link "oficial".

### 3. `index.html`

- Atualizar `<title>` e meta `description` se ainda mencionarem "CollectFlow" ou textos antigos relacionados à API. Verificar e ajustar para refletir RIVO CONNECT.

### 4. (Opcional) `docs/EDGE_FUNCTIONS.md` e `mem://integrations/api/rest-specification`

- Adicionar nota com a URL pública oficial: `https://rivoconnect.com/api-docs/public`.
- Confirmar lista de endpoints documentados (já está sincronizada com a edge function).

## O que NÃO muda

- A `BASE_URL` da edge function (`https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api`) — continua sendo o endpoint real chamado pelos clientes.
- Os exemplos de request/response (cURL, Python, Node.js) — já estão corretos.
- Autenticação `X-API-Key` com prefixo `cf_` — mantida (já documentada na memória `integrations/api/rest-specification`).
- Lista de endpoints (todos batem 1:1 com `supabase/functions/clients-api/index.ts`).

## Resultado esperado

- `https://rivoconnect.com/api-docs/public` exibe a doc com identidade visual RIVO CONNECT (laranja, semantic tokens, modo claro/escuro coerentes).
- Toda menção a "CollectFlow" removida.
- Admin em Configurações → API REST vê e copia a URL pública oficial de produção.
