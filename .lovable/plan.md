

# Plano: Fase 3 — Robustez Operacional, Auditoria, Concorrência e Segurança

## Resumo

Implementar controle de concorrência por lock de atendimento, expandir auditoria para todas as ações críticas, hardening de edge functions, idempotência reforçada e observabilidade operacional. Sem alterar UI, sem criar telas novas, sem mudar fluxos de negócio.

---

## Bloco 1: Lock de Atendimento (Controle de Concorrência)

**Estado atual**: Nenhum mecanismo de lock existe. Múltiplos operadores podem abrir o mesmo cliente simultaneamente.

### 1.1 — Criar tabela `atendimento_locks` (migration)

```sql
CREATE TABLE atendimento_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL,
  operator_name text NOT NULL,
  channel text,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '15 minutes',
  UNIQUE(tenant_id, client_id)
);
ALTER TABLE atendimento_locks ENABLE ROW LEVEL SECURITY;
-- RLS: tenant users can read/write own tenant
CREATE POLICY "tenant_locks" ON atendimento_locks
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- Auto-cleanup function
CREATE FUNCTION cleanup_expired_locks() RETURNS void
LANGUAGE sql AS $$ DELETE FROM atendimento_locks WHERE expires_at < now(); $$;
```

### 1.2 — Criar `src/services/lockService.ts`

- `acquireLock(tenantId, clientId, operatorId, operatorName, channel)`: tenta INSERT, retorna sucesso ou info do operador que tem o lock
- `renewLock(tenantId, clientId, operatorId)`: UPDATE expires_at += 15min
- `releaseLock(tenantId, clientId, operatorId)`: DELETE
- `checkLock(tenantId, clientId)`: SELECT, retorna lock ativo ou null
- Antes de acquire, limpa locks expirados com `cleanup_expired_locks()`

### 1.3 — Integrar no `AtendimentoPage.tsx`

- Ao abrir atendimento, chamar `acquireLock`
- Se lock ativo de outro operador: toast de aviso com nome do operador, modo somente leitura
- Se admin/gerente: opção de takeover (DELETE + INSERT)
- Renovação automática via `setInterval` a cada 5 minutos
- Ao fechar/sair: `releaseLock` no cleanup do useEffect

### 1.4 — Integrar no `findOrCreateSession`

- Chamar `acquireLock` ao criar sessão
- Associar lock ao session lifecycle

---

## Bloco 2: Auditoria Expandida

**Estado atual**: `logAction` já existe e é usado em ~15 pontos (clientService, agreementService, dispositionService, etc). Faltam ações críticas.

### 2.1 — Adicionar `logAction` nos pontos faltantes

| Serviço / Local | Ações a auditar |
|---|---|
| `importService` / `MaxListPage` | import_started, import_completed (count, credor) |
| `dispositionService.createDisposition` | disposition_created (já tem parcial, verificar) |
| `agreementService.updateAgreement` | agreement_updated (before/after status) |
| `cadastrosService` | credor_created, credor_updated, status_type_created |
| `AtendimentoPage` - save note | observation_added |
| `AtendimentoPage` - takeover | atendimento_takeover |
| `clientService.updateClient` | client_updated (changed fields) |
| `whatsappCampaignService` | campaign_started, campaign_completed |
| Operator assignment (CarteiraPage) | operator_assigned |

### 2.2 — Enriquecer `logAction` com campo `module`

Adicionar campo opcional `module` ao `logAction` para categorização:
```typescript
logAction({ 
  action: "import_completed", 
  entity_type: "import", 
  details: { count: 500, credor: "X", module: "maxlist" } 
});
```

Não precisa mudar a tabela — o `module` vai dentro de `details`.

---

## Bloco 3: Hardening de Edge Functions

### 3.1 — `maxsystem-proxy`

- Remover `ALLOWED_SLUGS` hardcoded — validar tenant dinamicamente via JWT/profile
- Adicionar timeout na chamada ao MaxSystem (fetch com AbortController, 30s)
- Log estruturado: tenant_id, action, count, duration

### 3.2 — `threecplus-proxy`

- Já tem validação JWT e tenant — verificar timeout
- Adicionar AbortController com 15s timeout
- Sanitizar logs para não vazar api_token

### 3.3 — `evolution-proxy`

- Verificar validação de JWT
- Adicionar timeout 15s
- Sanitizar headers/tokens nos logs

### 3.4 — Padrão de resposta de erro

Criar helper reutilizável para edge functions:
```typescript
function errorResponse(message: string, status: number, corsHeaders: Record<string,string>) {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
```

---

## Bloco 4: Idempotência e Resiliência

### 4.1 — `bulkCreateClients` — já usa `external_id` para dedup

Verificar que o upsert usa `onConflict: "tenant_id,external_id"`. Se não, corrigir.

### 4.2 — `createDisposition` — dedup por sessão

Adicionar verificação: se já existe disposition para mesmo `client_id + operator_id + disposition_type` nos últimos 30 segundos, ignorar (evitar duplo-clique).

### 4.3 — `createAgreement` — verificar acordo existente

Antes de criar acordo, verificar se já existe acordo pending/approved para mesmo CPF+credor+tenant. Se sim, rejeitar com mensagem clara.

---

## Bloco 5: Observabilidade Operacional

### 5.1 — Criar `src/services/operationalLogService.ts`

```typescript
export async function logOperationalEvent(params: {
  tenantId: string;
  module: string;
  action: string;
  success: boolean;
  durationMs?: number;
  details?: Record<string, any>;
  errorMessage?: string;
}) {
  // Insert into audit_logs com entity_type = "operational"
  // Usa supabase direto, sem depender de auth (para edge functions tb)
}
```

### 5.2 — Instrumentar módulos críticos

- `fetchCarteiraGrouped` — log com duration, count, filters
- `bulkCreateClients` — log com batch_size, success/fail count
- `fetchConversations` — log com count, duration
- Edge functions já logam via console — manter

### 5.3 — Página de Auditoria (`AuditoriaPage`)

Já existe. Adicionar filtro por `module` (dentro de details) para facilitar diagnóstico operacional. Sem criar nova tela.

---

## Bloco 6: Revisão de Segurança

### 6.1 — Verificar RLS nas tabelas críticas

Executar query de verificação via `supabase--read_query` para confirmar que todas as tabelas operacionais têm RLS ativo e policies corretas.

### 6.2 — Restringir ações por perfil no frontend

No `usePermissions`, as permissões já controlam acesso. Verificar que:
- `delete` em clients requer `carteira.delete`
- `import` requer `carteira.import`
- Takeover requer role admin/gerente
- Acesso admin telefonia/WhatsApp requer `contact_center.manage_admin`

### 6.3 — Sanitizar logs de edge functions

Revisar `threecplus-proxy`, `evolution-proxy`, `wuzapi-proxy` para não logar tokens/api_keys em console.log.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| **Migration SQL** | Tabela `atendimento_locks` + RLS + cleanup function |
| `src/services/lockService.ts` | Novo — acquire/renew/release/check lock |
| `src/pages/AtendimentoPage.tsx` | Lock lifecycle + aviso de operador ativo |
| `src/services/auditService.ts` | Campo module opcional |
| `src/services/clientService.ts` | logAction em updateClient |
| `src/services/dispositionService.ts` | Dedup por sessão |
| `src/services/agreementService.ts` | Verificar acordo existente antes de criar |
| `src/pages/MaxListPage.tsx` | logAction import_started/completed |
| `src/services/operationalLogService.ts` | Novo — log operacional |
| `supabase/functions/maxsystem-proxy/index.ts` | Remover ALLOWED_SLUGS, timeout, logs |
| `supabase/functions/threecplus-proxy/index.ts` | Timeout, sanitizar logs |
| `supabase/functions/evolution-proxy/index.ts` | Timeout, sanitizar logs |

## O que NÃO muda
- Layout, design, componentes visuais — intactos
- Lógica de negócio (acordos, comissões, score) — intacta
- Estrutura de tabelas existentes — intacta
- Fluxos operacionais aprovados — preservados
- Contact Center, chat, automação — intactos

## Ordem de implementação

1. Lock de atendimento (migration + service + integração)
2. Auditoria expandida (logAction nos pontos faltantes)
3. Idempotência (dedup disposition + verificação acordo)
4. Hardening edge functions (timeout + sanitização)
5. Observabilidade (log operacional + instrumentação)
6. Revisão de segurança (RLS + permissões)

