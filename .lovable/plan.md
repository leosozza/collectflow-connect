

# Gravar Categorização do Devedor no Histórico (client_events)

## Mudança

No `DebtorCategoryPanel.tsx`, após atualizar o `debtor_category_id` no client, inserir um registro em `client_events` com:
- `event_type`: `"debtor_category"`
- `event_source`: `"operator"`
- `event_channel`: `null`
- `event_value`: nome da categoria selecionada (ou `"removed"` se desmarcou)
- `metadata`: `{ category_id, category_name, category_color, previous_category_id }`
- `tenant_id`, `client_id`, `client_cpf` extraídos do contexto

## Arquivo: `src/components/atendimento/DebtorCategoryPanel.tsx`

- Adicionar props `tenantId` e `clientCpf` ao componente
- Na `mutationFn`, após o update do client, fazer um insert em `client_events`
- Buscar o nome da categoria selecionada a partir do array `categories` local

## Arquivo: `src/pages/AtendimentoPage.tsx`

- Passar `tenantId={tenant?.id}` e `clientCpf={client.cpf}` como props ao `DebtorCategoryPanel`

## Arquivo: `src/components/atendimento/ClientTimeline.tsx`

- Adicionar tratamento do `event_type === "debtor_category"` na renderização da timeline para exibir a mudança de categoria com ícone e texto adequados

