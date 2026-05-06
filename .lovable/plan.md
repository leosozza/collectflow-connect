## Diagnóstico

O sistema **está realmente disparando apenas para 50** (não é só o número exibido). Reproduzi a causa em `src/pages/CarteiraPage.tsx`.

### Causa raiz

A página da Carteira mantém uma seleção acumulada entre páginas em `selectedIds` / `selectedCpfs` (ex.: você marca 50 na página 1 + 30 na página 2 = 80). Mas o handler que abre o diálogo de WhatsApp só hidrata todos os clientes selecionados **quando o usuário usa "Selecionar todos"**:

```ts
// CarteiraPage.tsx, linha 670
const handleOpenWhatsapp = async () => {
  if (selectAllFiltered) {
    const all = await fetchBulkIfNeeded();          // ✅ pega todos
    ...
    setResolvedWhatsappClients(...);
  } else {
    setResolvedWhatsappClients(uniqueSelectedClients); // ❌ só os da página atual
  }
};
```

`uniqueSelectedClients` é derivado de `selectedClients`, que é `displayClients.filter(...)` — ou seja, **somente os clientes da página atual** (PAGE_SIZE = 50). Os 30 marcados em outras páginas são silenciosamente perdidos antes mesmo de chegar ao `WhatsAppBulkDialog`. Como o diálogo recebe só 50, todas as telas (resumo, distribuição por instância, criação da campanha) e o disparo real operam sobre 50.

A função utilitária `fetchBulkIfNeeded()` (linha 604) já trata o caso de "seleção acumulada entre páginas" usando `fetchCarteiraClientsByIds`. Ela só não está sendo chamada nesse caminho.

O mesmo padrão incorreto existe em `handleOpenDialer` (linha 660) e `handleOpenEnrich` (linha 685), então o discador e o enriquecimento sofrem do mesmo bug.

## Correção (apenas frontend)

Em `src/pages/CarteiraPage.tsx`, alterar os três handlers para sempre passar pelo `fetchBulkIfNeeded()` quando houver seleção que possa exceder a página atual:

1. **`handleOpenWhatsapp`** — remover o ramo `else` e sempre chamar `fetchBulkIfNeeded()`, depois deduplicar por CPF como já é feito.
2. **`handleOpenDialer`** — idem, sempre chamar `fetchBulkIfNeeded()`.
3. **`handleOpenEnrich`** — idem, sempre chamar `fetchBulkIfNeeded()` e mapear para `{id, cpf, credor}`.

`fetchBulkIfNeeded()` já tem o atalho rápido: se todos os `selectedIds` estão na página atual, ele filtra localmente sem ida ao backend; só busca via `fetchCarteiraClientsByIds` quando há IDs fora da página. Custo extra para o caso comum: zero.

Nada muda no `WhatsAppBulkDialog`, no `whatsappCampaignService` nem nas edge functions de disparo — eles já tratam corretamente N destinatários; só estavam recebendo a lista truncada.

## Validação

- Selecionar 50 na página 1 + 30 na página 2 → abrir "Disparo WhatsApp" → o resumo deve mostrar **80 selecionados / 80 destinatários únicos** (ou menos, se houver CPF duplicado/sem telefone).
- A distribuição por instância deve somar 80.
- Após enviar, conferir em `whatsapp_campaigns` / `campaign_recipients` que o total de destinatários criados é 80.

## Arquivos alterados

- `src/pages/CarteiraPage.tsx` (3 handlers, ~20 linhas)
