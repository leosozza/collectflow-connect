

# Integrar Categorização do Devedor no Score Operacional

## Situação Atual
O evento `debtor_category` é gravado em `client_events` mas o motor de score em `calculate-propensity` não o processa — ele é ignorado no `switch`.

## Lógica Proposta

A categorização do devedor pelo operador é um sinal de **Engajamento** — significa que houve interação suficiente para o operador classificar o perfil. Também pode impactar **Credibilidade** dependendo da categoria atribuída.

### Regras no motor de score:
- **Novo case `debtor_category`** no switch do `calculateScore`:
  - Conta como evento de engajamento positivo (o operador teve interação suficiente para categorizar)
  - `engagePos += weight` e `engageTotal += weight`
  - Se o `event_value` for `"removed"`, não conta como positivo (apenas `engageTotal += weight`)

### Impacto estimado:
- Leve boost na dimensão Engajamento (20% do score total)
- Clientes categorizados terão score marginalmente superior a não-categorizados, refletindo que houve análise humana do perfil

## Arquivo a editar
- `supabase/functions/calculate-propensity/index.ts` — adicionar case `debtor_category` no switch (~5 linhas)

## Evolução futura (Fase 2+)
Quando houver categorias com semântica definida (ex: "inadimplente recorrente", "primeira vez"), o score poderá usar o `metadata.category_name` para ajustar também a dimensão Credibilidade. Por agora, tratamos apenas como sinal genérico de engajamento.

