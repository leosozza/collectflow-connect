## Diagnóstico

A tela mostra **Cofre de Integrações → Negociarie: "Não configurado"** com os campos vazios. Isso **não é um bug** — é o estado real do banco:

- A Y.BRASIL tem **apenas 1 linha** em `tenant_integrations` para o provider `negociarie`:
  - `creditor_id = NULL` (escopo do tenant inteiro)
  - `uses_global_fallback = true`
  - `is_active = true`, `last_test_ok = true`
- **Nenhum credor** (incluindo o que está sendo editado na tela) tem credenciais próprias.

O componente `CreditorIntegrationsVault` consulta a linha **do credor atual** (`creditor_id = X`). Como ela não existe, ele retorna `has_credentials: false` → "Não configurado". A geração de boletos da Y.BRASIL **continua funcionando** porque o `negociarie-proxy` faz fallback para o nível do tenant (e este, para as credenciais globais via `NEGOCIARIE_CLIENT_ID/SECRET`).

Portanto o que está errado é a **UX**: o usuário não consegue distinguir "este credor não tem cofre próprio mas o tenant cobre via fallback" de "está realmente sem nada e vai falhar".

## O que ajustar (apenas UI/edge — sem mudança de regra)

### 1. `negociarie-credentials` — incluir info do escopo tenant no `get_status`

Quando a chamada vier com `creditor_id`, fazer **uma segunda leitura** da linha de tenant (`creditor_id IS NULL`) e devolver dois campos extras:

- `tenant_fallback_active: boolean` (existe linha tenant ativa com credenciais OU `uses_global_fallback`)
- `tenant_uses_global_fallback: boolean`

Sem alterar contrato existente.

### 2. `CreditorIntegrationsVault.tsx` — refletir o fallback

- Quando `has_credentials = false` **e** `tenant_fallback_active = true`:
  - Substituir o badge "Não configurado" por **"Usando cofre do tenant"** (variante neutra) e, se `tenant_uses_global_fallback`, complementar com "(fallback global)".
  - Mostrar uma linha curta abaixo do título: *"Este credor não possui credenciais próprias. As cobranças usam as credenciais configuradas no tenant. Configure abaixo apenas se este credor tiver Client ID/Secret próprios na Negociarie."*
- Quando `has_credentials = false` **e** `tenant_fallback_active = false`:
  - Manter "Não configurado" (estado real de risco) com texto: *"Sem credenciais — boletos deste credor falharão até configurar aqui ou no nível do tenant."*

### 3. `TenantIntegrationsVault.tsx` — espelhar a mesma clareza

- Se a linha do tenant existir só com `uses_global_fallback`, badge **"Fallback global ativo"** (neutro, não "Não configurado").
- Texto curto explicando que credenciais próprias do tenant sobrepõem o fallback global.

### 4. Smoke test após o ajuste

- Abrir credor da Y.BRASIL → deve mostrar "Usando cofre do tenant (fallback global)".
- Abrir tenant Y.BRASIL no `SuperAdminPage` → "Fallback global ativo".
- Salvar credenciais próprias num credor de teste → vira "Cofre Ativo".
- Remover credenciais → volta a "Usando cofre do tenant".

## Fora de escopo

- Migrar/forçar Y.BRASIL a ter credenciais próprias por credor.
- Mexer em `negociarie-proxy` / `negociarie-callback` (já corrigidos nas etapas anteriores).
- Logs de erro da seção "LOGS DE ERROS DE INTEGRAÇÃO" — já está vazio porque não há erros (comportamento correto).
