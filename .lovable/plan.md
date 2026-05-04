## Erro encontrado

A página não carrega devido a um **erro de sintaxe JSX** em `src/components/client-detail/AgreementInstallments.tsx`.

```
Plugin: vite:react-swc
File: src/components/client-detail/AgreementInstallments.tsx
x Expected '</', got 'jsx text'
```

## Causa raiz

Na coluna **Status** da tabela de parcelas (linha ~827–843), o `<TableCell>` de Status é aberto mas **nunca é fechado** antes da próxima `<TableCell>` da coluna "Pagamento" começar na linha 844:

```tsx
// Linha 827
<TableCell className="text-center ...">  // Status
  {isCancelled ? (...) : (...)}
                                     // ← falta </TableCell> aqui
// Linha 844
<TableCell className="text-center">     // Pagamento
```

Isso quebra todo o restante da árvore JSX (TableRow, TableBody, etc.), gerando os múltiplos erros em cascata que aparecem no log do Vite.

## Correção

Adicionar `</TableCell>` entre as linhas 843 e 844, fechando corretamente a célula de Status antes de abrir a célula de Pagamento.

## Arquivos afetados

- `src/components/client-detail/AgreementInstallments.tsx` (1 linha adicionada)
