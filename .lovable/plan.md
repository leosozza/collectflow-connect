
Mover "EM ABERTO" + valor para baixo do botão "Formalizar Acordo", alinhado à direita, sem criar nova linha no card — aproveitando o espaço vertical já existente da Linha 2 (CPF / Tel / Email / Credor).

### Mudança em `src/components/client-detail/ClientDetailHeader.tsx`

**Estrutura atual da Linha 1 (cluster direito):**
```
[EM ABERTO  R$ valor] [WhatsApp] [Atendimento] [Formalizar Acordo]
```

**Nova estrutura:**
- Cluster direito vira coluna com 2 níveis:
  - Topo: `[WhatsApp] [Atendimento] [Formalizar Acordo]`
  - Base (alinhado à direita, mesma linha visual de CPF/Tel/Email): `EM ABERTO  R$ 1.789,20`
- Remove o bloco "Em Aberto" inline atual (à esquerda dos botões).
- Container do cluster: `flex flex-col items-end gap-1 ml-auto shrink-0`.
- "EM ABERTO" em `text-[10px] uppercase tracking-wider text-muted-foreground` + valor em `text-base font-bold text-destructive`, lado a lado (`flex items-baseline gap-2`) para ocupar pouco espaço vertical e casar com a altura da Linha 2.

### Resultado visual
```
┌──────────────────────────────────────────────────────────┐
│ [←] Nome do Cliente            [Wpp][Atend][Formalizar] │
│     CPF • Tel • Email • Credor       EM ABERTO R$ X,XX  │
└──────────────────────────────────────────────────────────┘
```

Sem nova linha, sem aumentar altura do card.
