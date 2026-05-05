## Problema

`src/components/analytics/tabs/QualityTab.tsx` está com Syntax Error na linha 93, derrubando o Vite e impedindo o Analytics (e qualquer painel que importe a árvore) de renderizar.

A causa: o `.map(...)` na linha 80 usa corpo de arrow com chaves (`{ let motivo = ...; return (<TableRow>...</TableRow>); }`), mas é fechado com `))}` em vez de `})}`. Falta a chave de fechamento do bloco.

```text
80:  {(breakage.data || []).map((r: any, i: number) => {
...
92:    </TableRow>
93:  ))}        <-- errado: fecha como se fosse arrow expression
```

## Correção

Trocar `))}` por `})}` na linha 93 de `QualityTab.tsx`. Nenhuma outra mudança necessária — o restante do arquivo está íntegro.

Sem impacto em RLS, dados ou outras telas.
