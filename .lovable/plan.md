

# Plano: Botão "Atualizar Parcelas Pagas" — Atalho Rápido

## Resumo

Adicionar um botão direto na tela MaxList que busca no MaxSystem apenas parcelas com pagamento efetuado (usando filtro `PaymentDateEffectedQuery`) e executa a atualização inteligente automaticamente, sem precisar preencher filtros manualmente.

## Como funciona

O MaxSystem já suporta o filtro `PaymentDateEffectedQuery`. O botão vai:
1. Montar automaticamente um filtro de pagamento efetuado (ex: últimos 30 dias, ou período configurável)
2. Chamar a edge function `maxlist-import` com `mode: "update"` — que já faz o diff inteligente
3. Exibir o relatório final normalmente

Isso reduz drasticamente o volume consultado (só parcelas pagas) e simplifica a operação.

## Alterações

### `MaxListPage.tsx`
- Adicionar botão **"Atualizar Pagos"** no header da página (visível sempre, sem precisar buscar antes)
- Ao clicar: abrir mini-dialog pedindo apenas **Credor** e **Período de pagamento** (padrão: últimos 30 dias)
- Montar filtro OData: `PaymentDateEffectedQuery ge datetime'...' and PaymentDateEffectedQuery le datetime'...'`
- Buscar mapeamento salvo (mesmo fluxo existente)
- Chamar `supabase.functions.invoke("maxlist-import", { mode: "update", filter, ... })`
- Exibir resultado no `ImportResultDialog` existente

### Nenhuma alteração no backend
A edge function `maxlist-import` já suporta `mode: "update"` com diff inteligente. O filtro OData já é passado ao MaxSystem para buscar apenas os registros relevantes.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/MaxListPage.tsx` | Botão "Atualizar Pagos" + mini-dialog de período + chamada direta ao backend |

## O que NÃO muda
- Edge functions — intactas
- Layout geral — intacto
- Fluxo existente de busca + importar/atualizar — preservado
- Banco de dados — intacto

