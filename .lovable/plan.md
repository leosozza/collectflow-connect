

# Exibir campos personalizados na tela de atendimento

## Problema
O cliente possui dados em `custom_data` (JSONB na tabela `clients`) — como "nome do modelo" — mas esses valores não são exibidos na tela de atendimento.

## Solução

### 1. `src/components/atendimento/ClientHeader.tsx`
- Adicionar `custom_data` à interface do `client` (tipo `Record<string, any> | null`)
- Buscar as definições de campos personalizados do tenant via `fetchCustomFields` (usando o `tenant_id` do client ou via hook `useTenant`)
- Renderizar os campos personalizados que possuem valor no collapsible "Mais detalhes", em um grid com label e valor, usando um ícone genérico (ex: `Layers` ou `Tag`)
- Filtrar apenas campos ativos (`is_active`) e que tenham valor no `custom_data` do cliente

### 2. `src/pages/AtendimentoPage.tsx`
- Garantir que o `client` passado ao `ClientHeader` inclui o campo `custom_data` (já vem do `select("*")`, então nenhuma alteração necessária na query)

### Exibição
- No collapsible, antes das observações, renderizar uma seção "Campos Personalizados" com cada campo como: `[Label]: [Valor]`
- Para campos do tipo `select`, exibir o valor direto; para `boolean`, exibir "Sim/Não"

