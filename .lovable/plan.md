

# Exibir Campos Personalizados no Atendimento

## Problema

Campos personalizados (ex: "Nome do Modelo") definidos na tabela `custom_fields` nunca aparecem na seção expandida do atendimento porque:

1. **`atendimentoFieldsService.ts`** — `DEFAULT_FIELDS` e `seedDefaultFields` só incluem campos fixos do sistema. Campos personalizados nunca entram em `atendimento_field_config`.
2. **`ClientHeader.tsx`** — `FIELD_RENDERERS` só mapeia campos fixos. Não há renderer para campos `custom:*`, que ficam em `client.custom_data` (JSONB).
3. **`AtendimentoFieldsConfig.tsx`** — A tela de configuração no cadastro do credor também não mostra campos personalizados para o admin ligar/desligar.

## Mudanças

### 1. `src/services/atendimentoFieldsService.ts`
- Alterar `seedDefaultFields` para receber a lista de `custom_fields` do tenant e incluí-los no seed com `field_key: "custom:field_key"` e `label` do campo personalizado, após os campos padrão.
- Adicionar método `syncCustomFields(tenantId, credorId, customFields)` que insere campos personalizados faltantes no `atendimento_field_config` sem apagar os existentes.

### 2. `src/components/cadastros/AtendimentoFieldsConfig.tsx`
- Buscar `custom_fields` do tenant.
- Após o seed ou ao carregar, chamar `syncCustomFields` para garantir que novos campos personalizados sejam adicionados ao config sem resetar os existentes.

### 3. `src/components/atendimento/ClientHeader.tsx`
- Buscar `custom_fields` do tenant (query já existe em outras partes do sistema).
- Para cada `field_key` que comece com `"custom:"`, gerar um renderer dinâmico que lê de `client.custom_data[key]`.
- Na iteração de `visibleFields`, se não encontrar renderer estático, tentar o renderer dinâmico de campos personalizados.

## Fluxo Resultante

1. Admin cria campo personalizado "Nome do Modelo" (`field_key: nome_do_modelo`) em Cadastros > Credor > Personalização.
2. Ao acessar "Campos Visíveis no Atendimento" desse credor, o campo "Nome do Modelo" aparece na lista com toggle.
3. Na tela de atendimento, ao expandir "Mais informações", o campo aparece com o valor de `client.custom_data.nome_do_modelo`.

