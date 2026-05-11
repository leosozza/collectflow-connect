## Objetivo

Apenas visual: refatorar `src/components/gamificacao/CampaignCard.tsx` para adotar o estilo do mockup HTML (achievement card). **Zero mudança de funcionalidade, props, queries ou lógica.**

## O que muda (somente classes/markup visual)

### Card raiz
- `rounded-2xl` em vez do default
- Mantém `border-l-4 border-l-destructive` para expired

### Header
- Título maior: `text-xl font-extrabold tracking-tight`
- Badge de status como pill: `rounded-full uppercase text-[10px] font-bold tracking-wider`
- Tags (credor / métrica / período): `rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium`
- Datas em linha única com `Calendar` + (se expired) `AlertTriangle` vermelho com "Encerrou em dd/mm"

### Bloco Vencedor (expired)
- Caixa âmbar destacada: `rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4`
- Estrela decorativa absoluta com `opacity-10`
- Ícone em quadrado `bg-amber-100 dark:bg-amber-500/20 p-2 rounded-lg`
- Label "VENCEDOR" + nome `text-lg font-bold` + score `text-2xl font-black text-amber-600`

### Countdown (ativa)
- Mantém estilo gradiente atual, padding casado com o bloco vencedor (`p-3`)

### Prêmio
- Linha inline: `<Gift className="text-primary" />` + `prize_description` em `text-base font-semibold`

### Ranking
- Header "RANKING FINAL" / "RANKING" em `text-xs font-bold uppercase tracking-wide`
- Itens com `p-2 rounded-lg`, avatar `w-8 h-8`, medalha `text-lg w-6 text-center`
- `space-y-2`, separadores sutis `border-t border-border/30`

### Footer de ações
- `pt-4 border-t border-border` + `flex items-center justify-between flex-wrap`
- Botões `ghost size="sm"` com ícone `w-4 h-4`
- Conferência (todos), Recalcular (admin), Arquivar (admin+expired, `text-destructive`)

## Funcionalidades preservadas (sem qualquer alteração)

- `handleRecalculate`, `handleArchive`, `setAuditOpen` — idênticos
- `useQuery` de participantes — idêntico
- Condicionais: `isTenantAdmin`, `expired`, `isActive`, `datesValid`, `winner`
- `CampaignCountdown`, `CampaignAuditDialog` — sem mudança
- Props do componente — sem mudança

## Arquivos

- `src/components/gamificacao/CampaignCard.tsx` — único arquivo alterado

## Fora de escopo

- Nenhuma mudança em serviços, hooks, queries, RPCs, dialog de Conferência
- Nenhuma mudança em `CampaignsManagementTab` (grid responsivo preservado)
- Nenhuma mudança em tokens globais do design system
