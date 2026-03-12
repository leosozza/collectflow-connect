

# Plano: Corrigir contagem de clientes selecionados na Carteira

## Problema

Quando o usuário seleciona 10 linhas agrupadas na Carteira, cada linha representa um CPF único, mas `selectedIds` armazena todos os IDs individuais (parcelas). Assim, 10 CPFs com 46 parcelas mostram "Higienizar (46)" no botão — confuso para o usuário.

## Solução

Na `CarteiraPage.tsx`, calcular o número de CPFs únicos a partir de `selectedClients` e usar essa contagem nos botões da toolbar (linhas 554, 558, 563, 568) em vez de `selectedIds.size`.

```ts
const uniqueSelectedCpfs = new Set(selectedClients.map(c => c.cpf.replace(/\D/g, ""))).size;
```

Exibir nos botões:
- `Higienizar ({uniqueSelectedCpfs})` 
- `WhatsApp ({uniqueSelectedCpfs})`
- `Discador ({uniqueSelectedCpfs})`
- `Atribuir ({uniqueSelectedCpfs})`

## Arquivo modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/CarteiraPage.tsx` | Adicionar cálculo de CPFs únicos e usar nos botões |

