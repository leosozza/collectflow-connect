## Causa

O `<Link>` do nome está com `className="... truncate block"` — `block` faz o link ocupar **toda a largura da célula**, então qualquer clique/hover dentro da célula cai no link (parece "fora do nome", mas é o link inteiro esticado).

Além disso, na rodada anterior eu adicionei um `onClick` na célula para copiar o nome — agora o usuário quer o oposto: clique fora do nome **não faz nada**.

## Plano

Em `src/components/dashboard/ParcelasProgramadasCard.tsx` (linhas 170–186):

1. Remover o `onClick`/`title`/`cursor-copy` da `TableCell` — clique fora não dispara nada.
2. Trocar a classe do `<Link>` de `truncate block` para `inline-block max-w-full truncate align-middle` — o link passa a ter a largura **apenas do texto** (mais o ellipsis), não da célula inteira. Hover/click só na faixa exata do nome.

Sem mudança visual: o nome continua truncando com `…` se for longo, mesma cor, mesmo `hover:underline`.

Posso aplicar?
