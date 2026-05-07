## Diagnóstico

A aba de **Gerenciar → Rankings** permite criar rankings configurando uma **métrica** (`points`, `total_received`, `payments_count`, `agreements_count`) e um **período**. Porém, o ranking exibido em `RankingTab.tsx` (e no `MiniRanking` do dashboard) **ignora completamente a configuração**:

- `fetchRanking` em `src/services/gamificationService.ts` sempre faz `.order("points", { ascending: false })` no Supabase, independente do ranking configurado.
- A `position` (1º, 2º, 3º) é atribuída pela ordem que o Postgres retornou — ou seja, **sempre por pontos**.
- O card mostra "Recebido" e "Pontos" lado a lado, mas o pódio (medalhas) reflete só pontos. Por isso quem tinha mais pontos aparecia em 1º mesmo quando outro operador tinha mais valor recebido.

Adicionalmente, hoje só existe **um único ranking visível** na UI (o componente nem lê `ranking_configs`). A configuração de métrica não chega ao componente.

## Plano

### 1. Suportar a métrica configurada no `fetchRanking`

Em `src/services/gamificationService.ts`:
- Aceitar um parâmetro opcional `metric: 'points' | 'total_received' | 'payments_count' | 'agreements_count'` (default `'points'` para retrocompatibilidade).
- Buscar `operator_points` sem confiar no `order` do banco para tudo; ordenar no JS pelo campo da métrica escolhida (após calcular `agreements_count`, já que esse só existe pós-merge).
- Reatribuir `position` com base nessa ordenação final.
- Empate: desempatar por `total_received`, depois `points`.

### 2. Selecionar o ranking ativo na UI

Em `src/components/gamificacao/RankingTab.tsx`:
- Carregar `fetchRankingConfigs` (filtrar `is_active = true`).
- Se houver mais de um ativo, mostrar um `Select` "Ranking" ao lado dos seletores de mês/ano. Se houver só um, usar direto (sem Select). Se não houver nenhum, manter comportamento atual (`metric = 'points'`).
- Passar `metric` selecionada para `fetchRanking`.
- Destacar visualmente o valor da métrica escolhida no card (ex.: o número grande à direita passa a ser o valor da métrica; pontos viram badge secundário quando a métrica não for `points`). Manter o restante do layout.

### 3. Alinhar `MiniRanking` (dashboard)

Em `src/components/dashboard/MiniRanking.tsx`:
- Buscar o primeiro ranking ativo (mesma lógica) e passar a `metric` para `fetchRanking`.
- Se nenhum ativo, manter `points` como default.

### 4. Sem mudanças em backend / RLS / schema

Nenhuma migração necessária. `ranking_configs` já existe e já é consultada por `RankingManagementTab`. Toda a correção é frontend + ordenação no service.

## Arquivos afetados

- `src/services/gamificationService.ts` — assinatura e ordenação de `fetchRanking`.
- `src/components/gamificacao/RankingTab.tsx` — seleção do ranking ativo + destaque da métrica.
- `src/components/dashboard/MiniRanking.tsx` — usar métrica do ranking ativo.

## Fora do escopo

- Não vou alterar como `operator_points` é calculado nem regras de pontuação.
- Não vou mexer em `GoalsTab`, `GoalsManagementTab` ou `DashboardMetaCard` (já ajustados na etapa anterior).
