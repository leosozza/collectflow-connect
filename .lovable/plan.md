

# Ranking sem dados: integrar gamificação ao fluxo de pagamentos

## Problema
A tabela `operator_points` está **completamente vazia**. O hook `useGamification` existe e tem a lógica de calcular pontos e inserir na tabela, mas **nunca é chamado** em nenhum lugar da aplicação. O ranking depende desses dados para funcionar.

## Solução
Integrar a chamada de `checkAndGrantAchievements` nos pontos-chave onde pagamentos são registrados e acordos são criados/quebrados:

### 1. `src/pages/ClientsPage.tsx` — Após registrar pagamento
- No `onSuccess` do `paymentMutation`, chamar `checkAndGrantAchievements` com os dados atualizados do operador
- Buscar contadores do mês atual (pagamentos, valor recebido, quebras) via query na tabela `clients` + `agreements`

### 2. Criar helper `src/hooks/useGamificationTrigger.ts`
- Hook que encapsula a lógica de buscar os dados do mês e chamar `checkAndGrantAchievements`
- Função `triggerGamificationUpdate()` que:
  1. Busca contagem de pagamentos do mês do operador atual (clients com `data_quitacao` no mês)
  2. Busca total recebido (`SUM(valor_pago)`)
  3. Busca contagem de quebras (agreements `cancelled` no mês)
  4. Verifica se meta foi atingida (consulta `operator_goals`)
  5. Chama `checkAndGrantAchievements` com esses valores

### 3. Integrar em mais pontos de trigger
- `src/services/agreementService.ts` — quando acordo é criado
- Quando acordo é cancelado/quebrado (se houver essa ação na UI)

### 4. Ajustar RLS do `operator_points` para INSERT
- Atualmente, a policy de INSERT exige `operator_id = get_my_profile_id()`, mas o `upsertOperatorPoints` usa `upsert`. Precisamos garantir que o operador consiga fazer upsert dos próprios pontos.

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useGamificationTrigger.ts` | **Criar** — helper que busca stats do mês e chama checkAndGrantAchievements |
| `src/pages/ClientsPage.tsx` | **Editar** — chamar trigger no onSuccess do paymentMutation |
| `src/components/acordos/AgreementForm.tsx` | **Editar** — chamar trigger após criar acordo |

