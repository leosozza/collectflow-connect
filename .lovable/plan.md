## Objetivo

Corrigir a aba **Metas** na Gamificação (operador e admin) e garantir exibição correta no Dashboard.

---

## 1. Bug: operador vê "Nenhuma meta definida para este mês"

**Causa**: `fetchMyGoal` em `src/services/goalService.ts` não filtra `credor_id`. Quando o admin cria meta global (`credor_id = null`) **e** existe qualquer meta por credor para o mesmo operador/mês, `.maybeSingle()` retorna `null` (múltiplas linhas) → operador vê "sem meta".

**Fix**: adicionar `.is("credor_id", null)` em `fetchMyGoal` (a meta exibida ao operador é sempre a global, padrão já usado em `awardGoalIfReached`).

---

## 2. Aba Metas — visão do OPERADOR

Hoje mostra apenas o gauge do mês atual (ou vazio).

**Novo layout** (mantendo padrão "em linha" da imagem anexa):

- **Topo**: card com a **meta do mês atual** (gauge + valores recebido/meta/%).
- **Abaixo**: tabela "Histórico de Metas" com meses anteriores (últimos 6 meses) em linhas:
  - Colunas: `Mês`, `Meta`, `Recebido`, `Progresso (%)`, `Status` (Atingida / Não atingida).
  - Dados via `operator_goals` (do operador, `credor_id IS NULL`) + `operator_points` do mesmo período.
- Se não houver meta no mês atual: manter mensagem, mas ainda exibir histórico abaixo (se existir).

---

## 3. Aba Gerenciar → Metas (ADMIN)

Filtros (já existem): **Mês**, **Ano**, **Global ou Credor** — manter.

**Tabela atual**: `Operador | Meta Atual | Nova Meta (R$) | Pontos ao bater`

**Nova tabela**: `Operador | Meta Atual | Pontos ao bater | Ações`

- Remover coluna **"Nova Meta (R$)"**.
- Adicionar botão **Editar** (ícone lápis) por linha → abre **Dialog** com:
  - Campo `Meta (R$)` (CurrencyInput pré-preenchido com meta atual).
  - Campo `Pontos ao bater` (pré-preenchido).
  - Botões `Cancelar` / `Salvar` → chama `upsertGoal` com mês/ano/credor selecionados.
- Após salvar: invalidar `["goals", ...]`, `["my-goal", ...]`, `["dash-meta-my-goal", ...]`, `["dash-meta-goals", ...]`.
- Remover estados `editedGoals` / `editedPoints` e botão "Salvar" global do topo (não precisa mais).

---

## 4. Dashboard — Meta do operador

Após o fix do item 1, `DashboardMetaCard` (que já chama `fetchMyGoal`) passará a exibir corretamente a meta para operadores. Validar visualmente:

- Operador logado → vê sua meta global do mês.
- Admin sem filtro → soma das metas globais.
- Admin filtrando 1 operador → meta daquele operador.

Sem alterações de código necessárias além do item 1 (revisar invalidação das queries após salvar no item 3).

---

## Arquivos alterados

- `src/services/goalService.ts` — adicionar `.is("credor_id", null)` em `fetchMyGoal`.
- `src/components/gamificacao/GoalsTab.tsx` — adicionar histórico de meses anteriores para operador.
- `src/components/gamificacao/GoalsManagementTab.tsx` — substituir edição inline por botão "Editar" + Dialog; remover coluna "Nova Meta".

Sem mudanças de schema, RLS, RPC ou edge functions.

---

## Validação

1. Hard reload em `/gamificacao?tab=goals` como operador com meta de maio/2026 → ver meta no topo + histórico abaixo.
2. Admin em `Gerenciar → Metas` → editar meta de um operador via Dialog → operador vê valor atualizado imediatamente.
3. Dashboard do operador exibe gauge da meta corretamente.
