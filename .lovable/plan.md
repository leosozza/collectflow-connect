

# Plano: Unificação do Motor WhatsApp em 5 Fases

## Diagnóstico Atual

**Campanhas** (`send-bulk-whatsapp`): motor robusto com `sendByProvider()` suportando Evolution, Gupshup e WuzAPI. Resolve templates com 5 variáveis. Grava `message_logs` com metadata de rastreabilidade.

**Workflow-engine**: usa lógica própria — chama `evolution-proxy` diretamente, resolve apenas 3 variáveis (`{{nome}}`, `{{cpf}}`, `{{valor}}`), não grava `message_logs`, não suporta Gupshup nem WuzAPI.

**Problemas concretos**:
1. `sendByProvider()` existe apenas dentro de `send-bulk-whatsapp` — não é reutilizável
2. Workflow usa `{{valor}}` em vez de `{{valor_parcela}}`
3. Workflow não grava nada em `message_logs`
4. Campanha faz N+1 query no `clients` (linha 263, dentro do loop)
5. Workflow só funciona com Evolution/Baylers

---

## Fase 1 — Motor Único de Envio

Extrair `sendByProvider()` para um helper compartilhado dentro de `supabase/functions/`.

**Criar**: `supabase/functions/_shared/whatsapp-sender.ts`

Conteúdo: a função `sendByProvider()` atual (linhas 10-73 de `send-bulk-whatsapp`) extraída como módulo exportável. Mesma assinatura, mesma lógica. Retorna `{ ok, result, providerMessageId, provider }`.

**Alterar**: `send-bulk-whatsapp/index.ts` — importar de `../_shared/whatsapp-sender.ts` em vez de declarar localmente.

**Não alterar**: workflow-engine ainda (Fase 5). Campanhas continuam funcionando exatamente como antes.

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/whatsapp-sender.ts` | **Novo** — motor extraído |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Importar do shared |

---

## Fase 2 — Resolvedor Único de Templates

**Criar**: `supabase/functions/_shared/template-resolver.ts`

Função `resolveTemplate(template: string, client: any): string` que aplica todas as variáveis padronizadas:
- `{{nome}}` → `client.nome_completo`
- `{{cpf}}` → `client.cpf`
- `{{valor_parcela}}` → formatado BRL
- `{{valor}}` → alias de `{{valor_parcela}}` (compatibilidade)
- `{{data_vencimento}}` → formatado pt-BR
- `{{credor}}` → `client.credor`

**Alterar**: `send-bulk-whatsapp/index.ts` — substituir resolução inline (linhas 271-283 e 473-482) pela chamada a `resolveTemplate()`.

**Alterar frontend**: `src/services/whatsappTemplateService.ts` — adicionar `{{valor}}` como alias na lista `TEMPLATE_VARIABLES` e `SAMPLE_DATA`.

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/template-resolver.ts` | **Novo** — resolvedor unificado |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Usar `resolveTemplate()` |
| `src/services/whatsappTemplateService.ts` | Alias `{{valor}}` |

---

## Fase 3 — Logs Unificados

**Criar**: `supabase/functions/_shared/message-logger.ts`

Função `logMessage(supabase, params)` que insere em `message_logs` com campos padronizados:
- `tenant_id`, `client_id`, `client_cpf`, `phone`, `channel`, `status`, `message_body`, `error_message`, `sent_at`
- `metadata`: `{ source_type, campaign_id?, workflow_id?, execution_id?, node_id?, provider, provider_message_id, instance_id, instance_name }`

**Alterar**: `send-bulk-whatsapp/index.ts` — substituir inserts inline em `message_logs` (linhas 307-324, 341-356, 485-488, 522-527, 534-536) pela chamada a `logMessage()`.

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/message-logger.ts` | **Novo** — logger unificado |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Usar `logMessage()` |

---

## Fase 4 — Eliminar N+1 na Campanha

No `handleCampaignFlow()`, antes do loop de recipients:

1. Coletar todos os `representative_client_id` únicos dos recipients pendentes
2. Buscar todos os clientes em uma única query `.in("id", clientIds)`
3. Montar `Map<string, client>` em memória
4. Dentro do loop, usar `clientMap.get(recipient.representative_client_id)` em vez de query individual

Remover a query `clients` individual (linha 263-267).

| Arquivo | Mudança |
|---|---|
| `supabase/functions/send-bulk-whatsapp/index.ts` | Batch load de clientes |

---

## Fase 5 — Workflow-Engine no Motor Unificado

No `workflow-engine/index.ts`, na seção `action_whatsapp` (linhas 171-209):

1. Importar `sendByProvider` de `../_shared/whatsapp-sender.ts`
2. Importar `resolveTemplate` de `../_shared/template-resolver.ts`
3. Importar `logMessage` de `../_shared/message-logger.ts`
4. Substituir a lógica inline:
   - Usar `resolveTemplate()` em vez da resolução com 3 variáveis
   - Resolver instância: buscar instância default do tenant (qualquer provider, não apenas Evolution)
   - Carregar `tenantSettings` para suporte Gupshup/WuzAPI
   - Chamar `sendByProvider()` em vez de `evolution-proxy`
   - Chamar `logMessage()` com `source_type: "workflow"`, `workflow_id`, `execution_id`, `node_id`

| Arquivo | Mudança |
|---|---|
| `supabase/functions/workflow-engine/index.ts` | Usar shared helpers |

---

## Resumo dos Arquivos

| Arquivo | Fase | Tipo |
|---|---|---|
| `supabase/functions/_shared/whatsapp-sender.ts` | 1 | Novo |
| `supabase/functions/_shared/template-resolver.ts` | 2 | Novo |
| `supabase/functions/_shared/message-logger.ts` | 3 | Novo |
| `supabase/functions/send-bulk-whatsapp/index.ts` | 1-4 | Alterado |
| `supabase/functions/workflow-engine/index.ts` | 5 | Alterado |
| `src/services/whatsappTemplateService.ts` | 2 | Alterado |

Nenhuma migration. Nenhuma alteração em: campanhas frontend, gestão de campanhas, conversations, chat_messages, whatsapp-webhook, Contact Center, /atendimento, permissões.

