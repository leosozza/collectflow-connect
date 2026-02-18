
## Sistema de Gamificação para Operadores

### Objetivo
Criar um sistema completo de gamificação que incentive os operadores a maximizar o recebimento de parcelas e minimizar quebras, com ranking em tempo real, medalhas, conquistas automáticas, metas mensais e um painel de desempenho individual visível a todos.

---

### O que será construído

**1. Ranking em Tempo Real (Dashboard)**
- Painel de ranking gamificado no Dashboard de cada operador, mostrando posição atual no mês
- Medalhas visuais: 🥇 ouro, 🥈 prata, 🥉 bronze para top 3
- Métricas do ranking: valor recebido, % de recebimento vs quebra, pontuação calculada

**2. Painel de Gamificação Dedicado — `GamificacaoPage`**
- Acessível pela rota `/gamificacao` (visível a todos no sidebar)
- Aba de ranking completo dos operadores no mês
- Aba de conquistas do operador logado
- Aba de histórico de metas mensais
- Barra de progresso da meta do mês
- Leaderboard com animação de posição

**3. Conquistas Automáticas (Achievements)**
A tabela `achievements` já existe. O sistema irá criar conquistas automaticamente ao detectar marcos ao registrar um pagamento:

| Conquista | Gatilho | Ícone |
|---|---|---|
| Primeiro Recebimento | 1º pagamento registrado | 🎯 |
| 10 Pagamentos | 10 pagamentos acumulados | 🔟 |
| Sem Quebra no Mês | 0 quebras no mês corrente | 🛡️ |
| Meta Atingida | 100% da meta mensal atingida | 🏆 |
| 5 Dias Consecutivos | Pagamentos em 5 dias seguidos | 🔥 |
| Top Recebedor | 1º no ranking mensal | 👑 |
| R$10k Recebidos | Acumulado de R$10.000 | 💰 |
| R$50k Recebidos | Acumulado de R$50.000 | 💎 |

**4. Sistema de Pontuação**
Cada operador acumula pontos calculados assim:
- **+10 pontos** por pagamento registrado
- **+5 pontos** por cada R$100 recebidos
- **-3 pontos** por quebra registrada
- **+50 pontos** por conquista desbloqueada
- **+100 pontos** por meta do mês atingida

Os pontos ficam armazenados em uma nova tabela `operator_points`.

**5. Notificação de Conquista**
Ao desbloquear uma conquista, aparece um toast de celebração visual + a conquista é salva na tabela `achievements`.

---

### Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                   SISTEMA DE GAMIFICAÇÃO                    │
│                                                             │
│  ┌───────────────────┐    ┌──────────────────────────────┐  │
│  │   DashboardPage   │    │      GamificacaoPage         │  │
│  │                   │    │                              │  │
│  │  [Mini Ranking]   │    │  Ranking | Conquistas | Meta │  │
│  │  🥇 João  1.240pts│    │                              │  │
│  │  🥈 Maria   980pts│    │  🥇 Top operadores do mês   │  │
│  │  🥉 Pedro   720pts│    │  🏅 Conquistas desbloqueadas │  │
│  └───────────────────┘    │  📊 Histórico de metas       │  │
│                           └──────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │           useGamification hook                    │       │
│  │   checkAndGrantAchievements(operatorId, context) │       │
│  │   calculatePoints(clients, goals)                │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │          Banco de Dados (Cloud)                  │       │
│  │  achievements  (já existe)                       │       │
│  │  operator_points  (nova tabela)                  │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

### Detalhes Técnicos

**Nova tabela: `operator_points`**
```sql
CREATE TABLE operator_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  payments_count integer NOT NULL DEFAULT 0,
  breaks_count integer NOT NULL DEFAULT 0,
  total_received numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
Com constraint UNIQUE em `(tenant_id, operator_id, year, month)` para upsert seguro e RLS idêntica ao padrão do projeto.

**Arquivos a criar:**

| Arquivo | Descrição |
|---|---|
| `src/services/gamificationService.ts` | Lógica de pontos, conquistas e ranking |
| `src/hooks/useGamification.ts` | Hook para checar e conceder conquistas |
| `src/components/dashboard/MiniRanking.tsx` | Card de ranking resumido no Dashboard |
| `src/components/gamificacao/RankingTab.tsx` | Tabela de ranking completo com medalhas |
| `src/components/gamificacao/AchievementsTab.tsx` | Grid de conquistas desbloqueadas e bloqueadas |
| `src/components/gamificacao/PointsHistoryTab.tsx` | Histórico de pontos por mês |
| `src/pages/GamificacaoPage.tsx` | Página principal de gamificação |

**Arquivos a modificar:**

| Arquivo | O que muda |
|---|---|
| `src/pages/DashboardPage.tsx` | Adiciona `<MiniRanking>` no painel |
| `src/components/AppLayout.tsx` | Adiciona `/gamificacao` no sidebar (todos os usuários) e em `pageTitles` |
| `src/App.tsx` | Adiciona rota `/gamificacao` |
| `src/services/clientService.ts` | Chama `checkAndGrantAchievements` após `markAsPaid` e `markAsBroken` |

**Hook `useGamification`:**
```typescript
// Verifica marcos automaticamente ao registrar pagamento
checkAchievements(operatorProfileId, { 
  paymentsThisMonth, 
  totalReceived, 
  hasBreaksThisMonth,
  isGoalReached 
})
```

**Cálculo de pontuação (frontend, sem edge function):**
A pontuação é calculada em tempo real a partir dos dados de `clients` já carregados, sem precisar de nova query. A tabela `operator_points` serve como cache persistente para o histórico.

**Conquistas verificadas no cliente:**
Para evitar complexidade desnecessária, as conquistas são verificadas no frontend ao registrar um pagamento, consultando os dados já disponíveis e chamando um INSERT na tabela `achievements` via service. A checagem é idempotente — verifica se a conquista já existe antes de inserir.

**Mini Ranking no Dashboard:**
Mostra apenas os top 3 ou 5 do mês atual com medalhas animadas. Para operadores, mostra a própria posição em destaque. Para admins, mostra o ranking completo.

**Página de Gamificação:**
Acessível por todos (operadores e admins) pelo sidebar. Admins veem ranking de todos; operadores veem o próprio desempenho em destaque + ranking geral.

---

### Nenhuma edge function necessária.
### 1 nova tabela no banco: `operator_points`.
### Nenhuma dependência nova.
