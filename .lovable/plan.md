## Análise atual

O `CampaignCard` está com bastante "ar" e elementos repetidos verticalmente, criando a sensação de poluição vista no print:

1. **Header denso e empilhado**: título, descrição, badge de status, badges de credores, badges de métrica/período e linha de datas — cada um em uma linha própria. Para 3 cards lado a lado, isso empurra o ranking muito para baixo.
2. **Bloco de countdown** ocupa altura cheia mesmo quando a campanha está encerrada (no encerrado, o vencedor já cumpre o papel).
3. **Bloco do prêmio** (`Gift`) duplica visualmente o badge "Premio R$" — é uma faixa cinza separada do header.
4. **Botões de ação verticais** (Conferência / Recalcular / Mover) ocupam 3 linhas cheias `w-full`, o que estica o card para baixo sem necessidade.
5. **Faixa "CAMPANHA ENCERRADA"** no topo + Badge "Encerrada" no header são redundantes.
6. **Espaçamentos**: `CardHeader pb-3` + `CardContent space-y-3` + paddings internos dos sub-blocos somam muito.

## Proposta de reorganização (somente visual)

Mantém ordem lógica: Identidade → Contexto (credor/métrica/datas) → Estado (countdown OU vencedor) → Prêmio → Ranking → Ações.

### Header compacto

- Título + Badge de status na mesma linha (já está). Reduzir `pb-3` → `pb-2`.
- **Mesclar a faixa "Campanha encerrada"**: remover faixa superior cheia e usar apenas um pequeno alerta inline ao lado da data ("Encerrou em dd/mm"), aproveitando a borda esquerda destrutiva (`border-l-4`) que já marca visualmente o estado.
- **Linha única de metadados**: juntar credor + métrica + período + datas numa única linha flex-wrap com badges menores (`text-[10px]`, `h-5`), separadores `·`. Reduz 3-4 linhas para 1-2.
- Descrição opcional permanece logo abaixo do título, com `line-clamp-1` para não inflar.

### Bloco de estado (countdown / vencedor)

- Countdown: manter visual, reduzir `py-2 → py-1.5` e `mt-3 → mt-2`.
- Vencedor (encerrada): mantém destaque dourado mas com altura menor (`py-1.5`).
- Mutuamente exclusivos: já estão.

### Prêmio

- Integrar como linha enxuta logo acima do ranking: ícone `Gift` + texto inline (sem caixa de fundo separada). Se `prize_description` vazio, ocultar.

### Ranking

- Mantém top 5 e medalhas. Reduzir `space-y-1.5 → space-y-1` e `px-2 py-1 → px-2 py-0.5`. Avatar e nome inalterados.

### Ações

- **Reagrupar em uma única linha horizontal** com botões `size="sm"` lado a lado (`flex gap-2`), ícone + label curta. Em telas estreitas, `flex-wrap` mantém responsividade.
  - Todos: `Conferência`
  - Admin: + `Recalcular`
  - Admin + expired: + `Arquivar`
- Botões com `variant="ghost"` + borda sutil para reduzir peso visual, mantendo a hierarquia (CTA principal continua sendo o título/ranking).

### Espaçamentos globais

- `CardHeader`: `pb-2`, gaps internos `gap-1.5`.
- `CardContent`: `space-y-2 pt-0`.
- Faixa de encerrada superior: remover; manter só `border-l-4 border-l-destructive` + badge "Encerrada" no header + linha "Encerrou em dd/mm" inline ao lado das datas.

## Arquivos a alterar

- `src/components/gamificacao/CampaignCard.tsx` — única alteração necessária. Sem mudanças em serviços, lógica, props ou no `CampaignsManagementTab`.

## Fora de escopo

- Não muda comportamento, queries, lógica de cálculo, nem o diálogo de Conferência.
- Não muda o grid (`sm:grid-cols-2 lg:grid-cols-3`) — responsividade preservada.
- Não remove botões (Conferência, Recalcular, Arquivar continuam disponíveis nos mesmos contextos).
