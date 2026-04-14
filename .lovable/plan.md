

# Rastreabilidade MaxList: Auditoria Detalhada + Histórico do Cliente

## Problema
1. A sincronização MaxList registra apenas 1 resumo em `audit_logs` — não há como ver quais clientes foram alterados
2. Alterações feitas pela sincronização não aparecem no histórico individual do cliente

## Solução

### 1. Edge Function `maxlist-import/index.ts` — Registrar alterações em `client_update_logs`

No modo **update**, após o upsert de cada chunk com sucesso, inserir em batch na tabela `client_update_logs` os registros que tiveram alterações detectadas (`changes`). Campos:

- `client_id`: ID do registro existente
- `tenant_id`: tenant corrente
- `source`: `"maxlist"`
- `changes`: objeto `{ campo: { old, new } }` já calculado
- `updated_by`: null (ação de sistema)

O trigger existente `trg_client_event_from_update_log` cria automaticamente um `client_event` do tipo `field_update` com source `maxlist` — isso faz a alteração aparecer no **histórico/timeline do cliente** sem código adicional.

Inserção em batches de 200 para não impactar performance. Limitado a registros que realmente tiveram mudanças (já filtrados pelo diff existente).

### 2. Audit Log detalhado com lista de CPFs alterados

No `audit_logs` já existente, adicionar ao campo `details` a lista de CPFs e nomes dos clientes que foram atualizados (`updated_clients`), limitado aos primeiros 500 para não explodir o tamanho do JSON.

### 3. AuditoriaPage — Seção de download CSV dos alterados

Na página de Auditoria, quando o log selecionado for `maxlist_update` ou `maxlist_import`:
- Exibir lista dos clientes alterados (se disponível em `details.updated_clients`)
- Botão "Download CSV" que exporta: CPF, Nome, Campos Alterados (de → para)

Adicionar `maxlist_update` e `maxlist_import` ao mapa `actionLabels`.

### 4. ClientUpdateHistory — Label "MaxList"

Adicionar `maxlist: "MaxList"` ao `SOURCE_LABELS` no componente `ClientUpdateHistory.tsx` para que o badge exiba "MaxList" em vez de "maxlist".

## Arquivos alterados
- `supabase/functions/maxlist-import/index.ts` — inserir em `client_update_logs` após upsert
- `src/pages/AuditoriaPage.tsx` — exibir detalhes e CSV para logs MaxList
- `src/components/client-detail/ClientUpdateHistory.tsx` — adicionar label "MaxList"

## Resultado
- Cada cliente alterado pela sincronização MaxList terá o registro no seu histórico individual com source "MaxList"
- Na Auditoria, será possível ver e baixar CSV com todos os clientes afetados por cada sincronização

