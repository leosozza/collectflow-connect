

# Plano: Histórico unificado com `client_events` + nomes de operadores

## Problema

A aba "Histórico" em `ClientDetailPage.tsx` (linha 344-404) usa apenas `agreements` e `audit_logs` como fontes. Ela ignora a tabela `client_events`, que já recebe automaticamente via triggers: disposições, ligações, mensagens de chat, acordos, assinaturas e mensagens de prevenção. Além disso, os acordos não mostram o nome do operador que os criou.

O mesmo histórico aparece em `/atendimento` via `ClientTimeline.tsx`, que também não usa `client_events`.

## Solução

Substituir as fontes fragmentadas (agreements + audit_logs + dispositions) por uma única query à tabela `client_events`, que já centraliza tudo. Complementar com dados de `client_update_logs` (alterações de campo como telefone, higienização) e resolver nomes de operadores.

## Mudanças

### 1. `src/pages/ClientDetailPage.tsx` — Aba Histórico

- Substituir a construção manual de `items` por uma query à `client_events` filtrada por `client_cpf`
- Adicionar query a `client_update_logs` para incluir alterações de campos (telefone, higienização, etc.)
- Para cada evento que tenha `metadata.created_by` ou `metadata.operator_id`, resolver o nome do operador via batch query a `profiles`
- Renderizar todos os eventos em timeline unificada com ícones por `event_type`
- Manter a aba "Atualizações" separada (já usa `ClientUpdateHistory`)

### 2. `src/components/atendimento/ClientTimeline.tsx` — Histórico no Atendimento

- Adicionar prop opcional `clientCpf` para buscar `client_events` quando disponível
- Mesclar os eventos de `client_events` com as props existentes (dispositions, agreements, callLogs) removendo duplicatas por ID
- Incluir novos tipos de evento: `enrichment`, `field_change`, `message_sent`, `signature`
- Resolver nomes de operadores a partir de `metadata.created_by`

### 3. Triggers de banco — Incluir `created_by` nos metadados dos acordos

- Criar migration para atualizar o trigger `trg_client_event_from_agreement` para incluir `NEW.created_by` no campo `metadata`
- Isso garante que novos acordos já registrem quem criou

### 4. Trigger para `client_update_logs` → `client_events`

- Criar trigger que insere em `client_events` quando há insert em `client_update_logs`, com `event_type = 'field_update'`, `event_source = source`, e `metadata = changes`

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientDetailPage.tsx` | Aba Histórico: query `client_events` + `client_update_logs` + resolver nomes de operadores |
| `src/components/atendimento/ClientTimeline.tsx` | Aceitar `clientCpf`, buscar `client_events`, mesclar com props existentes |
| Migration SQL | Trigger `client_update_logs` → `client_events`; atualizar trigger de agreements para incluir `created_by` |

