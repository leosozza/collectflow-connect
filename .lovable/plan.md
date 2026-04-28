# Chaves de API por Credor

Atualmente cada `api_key` carrega só `tenant_id` — uma chave acessa todos os credores do tenant. Vamos adicionar **vínculo opcional com credor**, mantendo retrocompatibilidade total: chaves sem `credor_id` continuam sendo "chaves do tenant" (acessam todos os credores).

## Schema (migration)

Adicionar coluna em `api_keys`:

```sql
ALTER TABLE api_keys
  ADD COLUMN credor_id uuid REFERENCES credores(id) ON DELETE CASCADE;

CREATE INDEX idx_api_keys_credor ON api_keys(credor_id) WHERE credor_id IS NOT NULL;
```

- `credor_id IS NULL` → chave do **tenant inteiro** (comportamento atual, retrocompatível).
- `credor_id` preenchido → chave **escopada ao credor** (X-API-Key só enxerga dados daquele credor).

## Edge Function `clients-api`

### 1. Resolução da chave passa a devolver `credorId`

```ts
// retorna { tenantId, keyId, credorId | null }
.select("id, tenant_id, credor_id, is_active")
```

### 2. Filtro automático por credor quando a chave for escopada

Adicionar helper `applyScope(query, table)` que aplica `.eq('credor_id', credorId)` (ou coluna equivalente, ex.: `credor` em `agreements`) quando `credorId` está presente, em **todas** as rotas:

- `GET /clients`, `GET /clients/:id`, `DELETE`, etc. → filtrar por `credor_id`.
- `POST /clients` → forçar `credor_id` da chave (ignorar/validar o que vier no body).
- `GET /agreements`, `POST /agreements` → idem.
- `GET /payments`, `POST /payments/...` → idem (via `client_id` pertencente ao credor).
- `GET /payments/methods` → ignorar query param `?credor_id=` e usar o da chave.
- `POST /portal/lookup` e `POST /portal/agreement` → escopar.

**Validação na escrita:** se a request tentar inserir um `credor_id` diferente do da chave → `403 Forbidden`.

### 3. Tabela `clients` precisa de `credor_id`?

Verificar se `clients` já tem `credor_id` (ou apenas o texto `credor`). Caso só tenha o texto, o filtro será por `credor = (SELECT nome FROM credores WHERE id = credorId)` resolvido uma vez por request e cacheado.

## Frontend — Gestão de Chaves (`ApiDocsPage.tsx` + `apiKeyService.ts`)

### `apiKeyService.ts`

```ts
export interface ApiKey {
  // ...campos atuais
  credor_id: string | null;
  credor_nome?: string | null; // join opcional
}

export async function generateApiKey(
  tenantId: string,
  createdBy: string,
  label = "Nova Chave",
  credorId: string | null = null,   // ← NOVO
): Promise<GeneratedKey>
```

### UI da aba "API Keys"

No diálogo "Gerar nova chave":
- Campo **Label** (já existe)
- Novo **Select "Credor"** com opções:
  - **"Todos os credores (chave do tenant)"** → `credor_id = null`
  - Lista dos credores ativos do tenant
- Tabela de chaves passa a mostrar a coluna **"Credor"** (ou "Todos" quando `null`).

### Documentação dos Endpoints

Adicionar nota no topo da seção:
> "Chaves geradas para um credor específico operam exclusivamente sobre os dados daquele credor. Tentativas de acessar/criar registros de outros credores retornam 403."

## Auditoria

Os logs já gravam `api_key_id` em `import_logs` e nos inserts de `clients`. Como `api_keys` agora tem `credor_id`, o rastreamento "qual credor gerou esta operação via API" passa a ser direto via JOIN.

## Arquivos Alterados

- **Migration**: nova coluna + índice em `api_keys`
- `supabase/functions/clients-api/index.ts` — resolveApiKey + helper de escopo aplicado em todas as rotas
- `src/services/apiKeyService.ts` — interface + parâmetro opcional `credorId`
- `src/pages/ApiDocsPage.tsx` — Select de credor no diálogo + coluna na tabela
- `src/pages/ApiDocsPublicPage.tsx` — nota explicativa sobre escopo

## Retrocompatibilidade

Chaves existentes mantêm `credor_id = NULL` → continuam acessando todos os credores do tenant. **Nenhuma integração ativa quebra.**
