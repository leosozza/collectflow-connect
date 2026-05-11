## 1. Rotas de Gamificação no React Router

Substituir o sistema atual `?tab=...` por rotas reais aninhadas dentro de `/gamificacao`.

### Rotas (em `src/App.tsx`)

Trocar a rota única por rotas filhas com `Outlet`:

```text
/gamificacao                  → redirect para a aba padrão
/gamificacao/ranking          → RankingTab
/gamificacao/campanhas        → CampaignsTab
/gamificacao/conquistas       → AchievementsTab
/gamificacao/metas            → GoalsTab
/gamificacao/loja             → ShopTab        (operador)
/gamificacao/carteira         → WalletTab      (operador)
/gamificacao/historico        → PointsHistoryTab (operador)
/gamificacao/gerenciar        → ManageSubTabs  (admin)
```

### Refatoração

- `GamificacaoPage.tsx` vira um **layout**: mantém header, cards de KPIs e o `TabsList`, mas o conteúdo passa a ser `<Outlet />`. O `TabsList` usa `NavLink` (`asChild`) para navegar para cada rota, com `isActive` derivado do `useLocation().pathname`.
- Admin entrando em `/gamificacao` é redirecionado para `/gamificacao/ranking`; operador para `/gamificacao/metas`.
- Guarda: se operador acessar `/gamificacao/gerenciar` (ou admin acessar `/gamificacao/loja`), redireciona para a aba padrão.
- Remover o `useUrlState("tab", ...)` desta página. Manter compatibilidade redirecionando `/gamificacao?tab=campaigns` (e similares) para a rota nova via efeito.

## 2. Campanhas encerradas continuam visíveis na aba "Ativas"

A definição atual de "ativa" filtra `status === 'ativa'` **e** `end_date >= hoje`. Vamos separar esses dois conceitos:

- **Ativa** = `status='ativa'` e `end_date >= hoje`
- **Vencida (aguardando arquivamento)** = `status='ativa'` e `end_date < hoje` → continua na seção **"Campanhas Ativas"** com aviso
- **Encerrada/arquivada** = `status='encerrada'` → vai para o colapsável "Campanhas encerradas"

### Mudanças em `CampaignsTab.tsx`

- Listar na seção topo: ativas reais + vencidas (status `ativa`, end_date passado), ordenando vencidas no fim do bloco.
- Renderizar cada vencida com a prop `expired` no `CampaignCard`.

### Mudanças em `CampaignCard.tsx`

Quando `expired === true`:

- **Banner no topo do card**, bem visual: faixa com gradiente `from-destructive/15 to-warning/10`, borda esquerda destacada `border-l-4 border-destructive`, ícone `AlertTriangle` pulsante e texto **"CAMPANHA ENCERRADA"** + data de término formatada (`Encerrou em DD/MM/YYYY`).
- Card inteiro com leve dessaturação (`opacity-90`, `grayscale-[15%]`) para indicar estado finalizado, sem esconder o ranking final.
- Substituir o `CampaignCountdown` por um bloco "Resultado final" mostrando o vencedor (1º colocado) com destaque dourado.
- Se `isAdmin && expired`: botão **"Mover para encerradas"** no rodapé do card (variant `outline`, ícone `Archive`), com confirmação. Operador comum não vê o botão.

### Ação "Mover para encerradas"

- Chama `updateCampaign(id, { status: 'encerrada' })` (já existe em `campaignService.ts`).
- Invalida `["campaigns", tenantId]` para reflar o card no colapsável.
- Toast de sucesso "Campanha arquivada".
- Permissão: `isTenantAdmin` (já disponível via `useTenant`).

## 3. Backfill das campanhas da semana passada

Não vamos mudar o status delas no banco — elas permanecem com `status='ativa'` e a nova lógica de UI já as mostrará no topo com o banner "encerrada". O admin pode então clicar em **"Mover para encerradas"** quando quiser arquivar.

Isso é intencional: o usuário pediu exatamente esse comportamento ("quando encerrar continue na aba de ativas… com botão mover para encerrado"). Nenhuma migração SQL é necessária.

## Arquivos afetados

- `src/App.tsx` — novas rotas filhas
- `src/pages/GamificacaoPage.tsx` — vira layout com `<Outlet />` + `NavLink`s
- `src/components/gamificacao/CampaignsTab.tsx` — separa "ativas" de "vencidas" e mantém ambas no topo
- `src/components/gamificacao/CampaignCard.tsx` — prop `expired` + banner + botão admin "Mover para encerradas"
- `src/components/gamificacao/campaignTime.ts` — adicionar helper `isCampaignExpiredButNotArchived`

Sem alterações de schema, RLS ou edge functions.
