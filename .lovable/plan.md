## Diagnóstico

Os scores de campanhas atualizam de forma inconsistente porque hoje há **dois caminhos diferentes** mantendo a coluna `campaign_participants.score`:

1. **No mount da página** (`recalculate_my_full`, RPC `recalculate_operator_full`): atualiza scores **somente do operador logado**, nas campanhas em que ele participa. Usuário A não vê scores recentes do usuário B.
2. **Cron `gamification-recalc-tick`**: roda **a cada 30 minutos** (`*/30 * * * *`) e recalcula todos os operadores. É a única fonte que mantém o ranking inter-operador atualizado.

A `CampaignsTab` lê apenas a coluna persistida (`fetchCampaignParticipants` foi otimizado para isso), e Realtime invalida a query somente quando a tabela muda. Resultado prático:

- Logo após uma janela do cron (a cada 30 min): aparece atualizado.
- Entre janelas: aparece desatualizado, mesmo que tenham entrado pagamentos/acordos novos.
- Quando o operador atual abre a página: ele vê **o próprio score** atualizado (RPC do mount), mas os colegas continuam congelados até o próximo tick.

Isso é exatamente "às vezes atualiza, às vezes não".

Há também um warning React no console (`Function components cannot be given refs ... CampaignCountdown`). É efeito colateral de HMR após eu reescrever o componente — mas como `CampaignCard` ainda passa props/forwardRef pelo DOM e o Vite às vezes serve uma versão stale, vale garantir que `CampaignCountdown` aceite ref formalmente para silenciar o aviso. Não causa o bug de atualização, mas elimino junto.

## Correção

### 1. Recalcular a campanha inteira (todos os operadores) no mount, em background

Usar a RPC já existente `recalculate_campaign_scores(_campaign_id uuid)` (definida em `20260429192000_*.sql`) para cada campanha **ativa** assim que `CampaignsTab` ou `CampaignsManagementTab` montar — uma única vez por mount, em paralelo, e fora do caminho crítico de render. Ao terminar, invalidar `campaign-participants` para refletir.

Diferença em relação à versão antiga (que foi removida na otimização):
- A versão antiga rodava em `forEach` síncrono dentro do render, multiplicando latência.
- A nova roda dentro de `requestIdleCallback` + `Promise.allSettled`, sem bloquear o "first useful pixel" e sem encadear roundtrips.
- Limita-se a campanhas **ativas** (já filtradas pelo helper `isCampaignActive`), evitando trabalho desnecessário em encerradas.

### 2. Throttle / dedupe entre tabs e remontes

Para não disparar o recálculo se o usuário entra/sai do tab Gamificação repetidamente, manter um cache em memória `lastRecalcAt: Map<campaignId, ms>` com TTL de 60s. Se foi recalculada há menos de 60s nesta sessão, pula. Mantém custo controlado.

### 3. Realtime já existente cobre a propagação

A subscription em `CampaignsTab` já invalida `campaign-participants` quando `campaign_participants` muda — ou seja, assim que a RPC do passo 1 atualiza as linhas, todos os cards re-renderizam automaticamente com os novos números, **sem nenhum polling adicional**.

### 4. Silenciar o warning de ref

Tornar `CampaignCountdown` um `forwardRef<HTMLDivElement, Props>` (envolvendo a div externa). Trivial e elimina a mensagem do console.

## Arquivos alterados

- `src/services/campaignService.ts`: nada estrutural — apenas garantir que `recalculateCampaignScores` está exportada (já está) e adicionar comentário sobre o uso correto.
- `src/components/gamificacao/CampaignsTab.tsx`: novo `useEffect` que, quando `active` muda, dispara `recalculateCampaignScores` para cada campanha ativa via `requestIdleCallback` com dedupe de 60s; ao final, `queryClient.invalidateQueries({ queryKey: ["campaign-participants"] })`.
- `src/components/gamificacao/CampaignsManagementTab.tsx`: mesmo efeito (mesmo helper, importado de um util compartilhado para evitar duplicação).
- Novo `src/components/gamificacao/useRefreshActiveCampaignScores.ts`: encapsula o dedupe + idle dispatch, importado pelas duas tabs.
- `src/components/gamificacao/CampaignCountdown.tsx`: converter para `forwardRef` (resolve warning de console).

## Não alterar

- O cron `gamification-recalc-tick` (continua sendo a rede de segurança a cada 30 min para usuários offline).
- A leitura direta de `campaign_participants.score` no `fetchCampaignParticipants` (mantém a otimização anterior).
- Qualquer lógica de cálculo de score (continua 100% server-side via RPC).

## Resultado esperado

- Ao abrir Gamificação → aba Campanhas: scores são recalculados em background no servidor para todas as campanhas ativas. O Realtime injeta os valores novos nos cards em ~1–2s.
- Sem regressão de performance: o trabalho roda em idle, paralelo e com dedupe de 60s.
- Warning React de ref no console desaparece.
