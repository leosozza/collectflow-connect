

# FASE 2 — Identidade de Contato e Telefone como Camada Oficial

## Situação Atual

- Tabela `client_phones` existe mas está **vazia** (0 registros)
- `clients` tem **169.757 registros** com phones (maioria 11 dígitos DDD+9)
- Tabela `client_phones` usa `cpf` como vínculo (não `client_id`) — correto para o modelo agrupado por CPF/credor
- Já tem UNIQUE em `(tenant_id, cpf, phone_number)` e índice em `(tenant_id, cpf, priority)`
- **Faltam**: colunas normalizadas para lookup rápido e dados populados

## O Que Será Feito

### 1. Migration SQL — Adicionar colunas normalizadas + índices

Adicionar à tabela `client_phones`:
- `phone_e164` (text) — formato internacional `5511999887766`
- `phone_last8` (text) — últimos 8 dígitos para fallback
- `phone_last10` (text) — últimos 10 dígitos
- `client_id` (uuid, nullable, FK → clients) — link direto opcional

Criar índices:
- `(tenant_id, phone_e164)` — match exato
- `(tenant_id, phone_last8)` — fallback por sufixo

### 2. Migration SQL — Migrar dados de `clients.phone/phone2/phone3`

Inserir em `client_phones` todos os telefones existentes com normalização:
- Telefones de 10-11 dígitos → `phone_e164` = `55` + telefone (13 dígitos, com 9° dígito inserido se necessário)
- `phone_last8` e `phone_last10` calculados automaticamente
- `priority`: phone=1, phone2=2, phone3=3
- `is_whatsapp`: true para phone (priority 1)
- `source`: `'migration'`
- `client_id`: linkado ao `clients.id` correspondente
- Respeitar o UNIQUE existente (ON CONFLICT DO NOTHING)

### 3. Função RPC — `resolve_client_by_phone`

Criar função PostgreSQL `SECURITY DEFINER`:
```text
resolve_client_by_phone(_tenant_id uuid, _phone text)
→ RETURNS TABLE(client_id uuid, cpf text, phone_e164 text, priority int)
```

Lógica:
1. Normalizar o input para e164
2. Buscar match exato por `phone_e164`
3. Se não encontrar, fallback por `phone_last8`
4. Filtrar por `tenant_id`
5. Ordenar por `priority ASC`
6. Retornar primeiro resultado

### 4. Trigger — Manter `client_phones` sincronizado

Criar trigger `AFTER INSERT OR UPDATE` em `clients` que sincroniza `phone`, `phone2`, `phone3` para `client_phones` automaticamente. Isso garante que novos imports e edições mantenham a tabela atualizada.

### 5. Atualizar enrichment (targetdata)

Os webhooks de enriquecimento já populam `client_phones` — apenas adicionar o preenchimento das novas colunas (`phone_e164`, `phone_last8`, `phone_last10`).

### 6. NÃO alterar lookups existentes ainda

O webhook e o `useClientByPhone` continuam usando o método antigo. A substituição será na Fase 4 (RPC de ingestão). Esta fase apenas **prepara a base**.

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| Migration SQL | Colunas + índices + migração de dados + trigger + RPC |
| `supabase/functions/targetdata-enrich/index.ts` | Preencher `phone_e164`, `phone_last8`, `phone_last10` |
| `supabase/functions/targetdata-webhook/index.ts` | Preencher `phone_e164`, `phone_last8`, `phone_last10` |

## Sem alteração em

- `whatsapp-webhook/index.ts` — mantém lookup antigo (será trocado na Fase 4)
- `useClientByPhone.ts` — mantém lookup antigo
- Frontend — nenhuma alteração

## Riscos

| Risco | Mitigação |
|---|---|
| Migração de ~170k × 3 = ~500k registros | INSERT com ON CONFLICT DO NOTHING, executado em SQL único |
| Telefones com formato irregular (≤9 dígitos) | Filtrar: só migrar telefones ≥10 dígitos |
| Trigger pode impactar imports em massa | Trigger é simples (upsert), custo mínimo |

## Resultado

- `client_phones` populada com ~500k registros normalizados
- Lookup por telefone escalável via índice (sem ILIKE)
- RPC pronta para uso nas fases seguintes
- Trigger garante sincronização automática
- Zero impacto na operação atual

