

## Problema Identificado

Os 3 registros **foram importados com sucesso** no banco de dados (credor "YBRASIL", vencimento 18/02/2026). Porem estao sem `status_cobranca_id` (null), o que pode dificultar a localizacao na Carteira dependendo dos filtros ativos.

## Solucao

### 1. Adicionar seletor de Status de Cobranca na pagina MaxList

Antes do botao "Enviar para CRM", adicionar um `Select` que permita escolher qual status de cobranca sera atribuido aos registros importados. O padrao sera **"Aguardando acionamento"**.

### 2. Incluir `status_cobranca_id` no upsert

Na funcao `handleSendToCRM`, incluir o campo `status_cobranca_id` selecionado em cada registro do batch, garantindo que os devedores importados ja entrem com o status correto.

---

### Detalhes Tecnicos

**Arquivo:** `src/pages/MaxListPage.tsx`

**Alteracoes:**

1. **Novo estado** `selectedStatusCobrancaId` inicializado com o UUID de "Aguardando acionamento" (buscado dinamicamente via query na tabela `tipos_status`).

2. **Query dos tipos_status** usando `useQuery` + `fetchTiposStatus` (ja usado em outras paginas) para popular o select.

3. **Select de Status** renderizado junto aos controles de importacao (proximo ao botao "Enviar para CRM"), com as opcoes vindas de `tipos_status`.

4. **No `handleSendToCRM`**, adicionar `status_cobranca_id: selectedStatusCobrancaId` nos objetos `rows` enviados no upsert.

5. O default "Aguardando acionamento" sera identificado pelo nome ao carregar os tipos, setando automaticamente o estado inicial.

