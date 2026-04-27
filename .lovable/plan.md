## Alterações no card "Parcelas Programadas"

Arquivo: `src/components/dashboard/ParcelasProgramadasCard.tsx`

### 1. Reduzir a barra azul de data
A barra azul ocupa 100% da largura do card. Ela vai ser reduzida ao tamanho do conteúdo (setas + data) e centralizada horizontalmente na linha.

- Container externo: `flex items-center justify-center gap-2` (em vez de bloco full-width).
- Barra azul: `inline-flex` com padding compacto (`px-1 py-1`), botões 24px (`h-6 w-6`) e ícones 14px.
- Texto da data: `text-xs font-bold`, largura mínima `min-w-[88px]` para não "pular" ao trocar entre "HOJE" e datas.

### 2. Quadradinhos de contagem ao lado da data
À direita da barra azul, dois badges quadrados mostrando apenas o número (como no modelo anexado):

- **Andamento** (cinza/azul claro): conta parcelas com status diferente de `paid` e `overdue`. Estilo: `bg-blue-500/15 text-blue-600`.
- **Pagas** (verde): conta parcelas com status `paid`. Estilo: `bg-success text-success-foreground`.

Cada quadradinho: `h-8 min-w-[32px] px-2 rounded-md text-xs font-bold tabular-nums`, com `title` no hover indicando o significado do número.

### Layout resultante

```text
              [‹  HOJE  ›]  [ 2 ]  [ 0 ]
```

Centralizado dentro do card, sem ocupar toda a largura.

### Observações
- Sem mudança de dados/queries — os contadores derivam da prop `vencimentos` já existente.
- Sem cores hardcoded fora do design system (uso de tokens `success`, `success-foreground` e classes de azul já usadas no componente).
- Nenhum outro arquivo é alterado.
