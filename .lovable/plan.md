## Nova Lógica: Pontos → Rivo Coins (conversão mensal)

### Conceito

- **Pontos** = moeda **temporária e mensal**, acumulada durante o mês corrente.
- Pontos vêm de **3 fontes** (todas geram pontos, não Rivo Coins direto):
  1. **Bater meta** (`operator_goals`) — pontos definidos por configuração.
  2. **Ganhar campanha** (`gamification_campaigns`) — pontos por posição final (1º, 2º, 3º…).
  3. **Atingir conquistas** (`achievement_templates.points_reward`) — pontos da conquista.
- Ao **virar o mês**, todos os pontos do mês fechado são **convertidos automaticamente em Rivo Coins** (1 ponto = 1 Rivo Coin) e creditados na carteira.
- **Rivo Coins** = saldo permanente, gasto na Loja.

---

### O que muda em relação a hoje

| Comportamento | Hoje | Depois |
|---|---|---|
| Conquistas | Creditam Rivo Coins **diretamente** ao desbloquear | Creditam **Pontos** no mês corrente |
| Metas batidas | Sem recompensa formal (só flag) | Geram **Pontos** configuráveis |
| Vencer campanha | Sem recompensa em moeda | Top N posições recebem **Pontos** configuráveis |
| Pontos do ranking | Calculados por regras (pagamentos, valor recebido, etc.) e usados só para posição | Continuam, **somam ao saldo de pontos do mês**, e viram Rivo Coins na virada |
| Rivo Coins | Crédito imediato a cada conquista | Crédito **único na virada do mês**, consolidando tudo |
| Carteira de Rivo Coins | Inalterada (segue gasto na loja) | Inalterada |

---

### Mudanças técnicas

**1. SQL — novas colunas**
- `gamification_campaigns`: adicionar `points_first int default 0`, `points_second int default 0`, `points_third int default 0` (ou JSONB `position_rewards`).
- `operator_goals`: adicionar `points_reward int default 0`.
- `operator_points`: adicionar `bonus_points int default 0` (acumula pontos extras de meta/campanha/conquista, separado dos pontos calculados por regras) e `converted_to_coins boolean default false`.

**2. SQL — RPC de conversão mensal**
- Nova RPC `convert_monthly_points_to_rivocoins(_year int, _month int)`:
  - Busca todas as linhas `operator_points` do mês alvo onde `converted_to_coins = false`.
  - Para cada operador: `total = points + bonus_points` → credita em `rivocoin_wallets` e insere `rivocoin_transactions` (type='earn', reference_type='monthly_conversion').
  - Marca `converted_to_coins = true`.
- Cron job (`pg_cron`) rodando dia 1 de cada mês às 00:05 → converte mês anterior.
- RPC manual `convert_my_pending_points()` para admin disparar reprocessamento.

**3. SQL — RPC de fechamento de campanha**
- `close_campaign_and_award_points(_campaign_id uuid)`:
  - Lê `campaign_participants` ordenado por `score`.
  - Credita `bonus_points` em `operator_points` para top 3 conforme configuração da campanha.
  - Atualiza `campaigns.status='completed'`.

**4. Código (frontend/services)**
- `src/hooks/useGamification.ts`: trocar `creditRivoCoins(...)` por incremento em `operator_points.bonus_points` quando conquista é desbloqueada.
- `src/services/goalService.ts`: ao detectar meta batida, somar `points_reward` em `operator_points.bonus_points`.
- `src/services/campaignService.ts`: novo botão/ação "Encerrar campanha" chamando `close_campaign_and_award_points`.
- `src/components/gamificacao/AchievementsManagementTab.tsx`: rótulo "Recompensa" continua em pontos (sem mudança de UI, só semântica).
- Nova UI em **Campanhas**: campos de pontos por posição (1º/2º/3º).
- Nova UI em **Metas**: campo "Pontos ao bater a meta".
- Tab **Wallet** / **Ranking**: mostrar "Pontos do mês (vão virar Rivo Coins em DD/MM)" e histórico de conversões.

**5. Migração de dados existentes**
- Não retroagir: Rivo Coins já creditadas permanecem. Nova lógica vale a partir do mês corrente.

---

### Resultado esperado

- Operador acompanha **pontos crescendo no mês** (ranking + bônus de meta/campanha/conquista).
- No dia 1 do mês seguinte, recebe notificação: "Você converteu X pontos em X Rivo Coins!".
- Loja continua funcionando normalmente com saldo de Rivo Coins.
