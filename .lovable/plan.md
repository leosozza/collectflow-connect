## Objetivo

Cada credor precisa ter suas próprias credenciais de API claramente vinculadas e gerenciáveis. O backend **já suporta** chaves escopadas por `credor_id` (coluna em `api_keys`, validada em `clients-api/index.ts` linhas 39–64 e usada para filtrar `credor_id` em todos os endpoints). O que falta é uma **interface dedicada** que organize isso por credor.

## O que existe hoje

- `src/pages/ApiDocsPage.tsx` → aba **"API Keys"** com tabela única, listando todas as chaves e um seletor de credor dentro do diálogo "Nova Chave".
- `src/services/apiKeyService.ts` → `fetchApiKeys`, `generateApiKey(tenantId, createdBy, label, credorId)`, `revokeApiKey`, `updateApiKeyLabel`. Tudo pronto.
- Edge `clients-api` já valida e escopa por `credor_id` automaticamente.

Nada disso será alterado — preserva 100% do que está em produção (Y.brasil e demais).

## O que vamos adicionar

### 1. Nova aba em `ApisPage.tsx`

Adicionar uma terceira sub-aba ao lado de **"API REST"** e **"Servidor MCP"**:

```text
[ API REST ] [ Credenciais por Credor ] [ Servidor MCP ]
```

A nova aba renderiza um componente novo `CredorCredentialsPanel`.

### 2. Componente `src/components/api-docs/CredorCredentialsPanel.tsx` (novo)

Layout:

- Cabeçalho explicando: "Cada credor pode ter sua própria chave de API. A chave fica restrita aos dados daquele credor."
- Campo de busca por nome do credor.
- Lista (cards expansíveis) — **uma linha por credor ativo do tenant**, mais um card "Chaves globais (todos os credores)" no topo:
  - Nome do credor + badge contando chaves ativas.
  - Botão **"Gerar credencial"** (abre diálogo com label pré-preenchido `"<Nome do credor> — API"` e `credorId` já fixado, sem seletor).
  - Tabela inline com as chaves daquele credor: label, prefixo, status, último uso, criado em, ação de revogar.
  - Botão **"Copiar exemplo cURL"** que monta o snippet pronto com a URL base + `X-API-Key`.
- Card final "URL Base" e link para a documentação completa (aba "API REST").

### 3. Reuso de serviços

Usa exatamente `fetchApiKeys`, `generateApiKey`, `revokeApiKey`. Sem mudanças em serviços, em RLS ou em edge functions.

Agrupamento client-side:

```ts
const byCredor = new Map<string | "__global__", ApiKey[]>();
apiKeys.forEach(k => {
  const key = k.credor_id ?? "__global__";
  if (!byCredor.has(key)) byCredor.set(key, []);
  byCredor.get(key)!.push(k);
});
```

### 4. Aba "API Keys" antiga

Mantida intacta na página `ApiDocsPage` (continua sendo a visão técnica/avançada com todas as chaves numa tabela única). Nada removido — apenas adicionamos a visão por credor.

## Diagrama

```text
ApisPage
├── API REST          → ApiDocsPage (existente, inalterado)
├── Credenciais por   → CredorCredentialsPanel (novo)
│   Credor              ├── Card: Chaves globais
│                       ├── Card: Credor A  → [chaves do A] + Gerar
│                       ├── Card: Credor B  → [chaves do B] + Gerar
│                       └── ...
└── Servidor MCP      → McpDocsPage (existente, inalterado)
```

## Permissões

Apenas `isTenantAdmin` vê o botão "Gerar credencial" e "Revogar" (mesmo gate já usado em `ApiDocsPage`).

## Arquivos tocados

- `src/pages/ApisPage.tsx` — adicionar a 3ª aba e roteamento.
- `src/components/api-docs/CredorCredentialsPanel.tsx` — **novo**.

Sem migrations, sem mudança em edge functions, sem alteração em serviços. Zero risco para Y.brasil e demais tenants já operantes.
