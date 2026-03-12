

# Corrigir identificação de operadores e limpar ranking de Relatórios

## Problema raiz

O campo `agreements.created_by` armazena o `auth.uid()` (ex: `ddfcb452-...`), mas a query de profiles em RelatoriosPage busca `profiles.id` (ex: `3975cf0e-...`). Como são IDs diferentes, o `.find()` nunca encontra match e mostra "Sem operador".

Dados reais confirmam:
- `agreements.created_by = ddfcb452-...` → `profiles.user_id = ddfcb452-...` → `profiles.id = 3975cf0e-...` (Vitor Santana)
- A query busca por `profiles.id`, mas compara com `created_by` (que é `user_id`)

## Alterações

### 1. `src/pages/RelatoriosPage.tsx` — Remover OperatorRanking + corrigir query de profiles

- Remover import e uso do `OperatorRanking` (ranking fica só na Gamificação)
- Alterar query de profiles para incluir `user_id` além de `id`
- Mapear operadores usando `user_id` como chave (para match com `agreements.created_by`)
- Isso corrige automaticamente os filtros e a Prestação de Contas

### 2. `src/components/relatorios/PrestacaoContas.tsx` — Corrigir lookup de operadores

- O componente recebe `operators` com `{ id, name }` — precisa que o `id` seja o `user_id` do auth para fazer match com `created_by`
- Verificar se o ranking interno de PrestacaoContas também usa `created_by` e ajustar

### 3. Gamificação — Campanhas sem scores

O `campaign_participants.score` está sempre `0` porque nenhum processo atualiza o score dos participantes. O `useGamificationTrigger` atualiza `operator_points`, mas não atualiza `campaign_participants.score`.

- Em `src/hooks/useGamificationTrigger.ts`: após calcular os stats do mês, buscar campanhas ativas do tenant e atualizar o score dos participantes baseado na métrica da campanha

### 4. Gamificação Ranking — Mesmo problema de ID

O `useGamificationTrigger` usa `profile.id` como `operator_id` no `operator_points`, mas o `fetchRanking` busca profiles por `profiles.id`. Isso está correto internamente. Porém o trigger é chamado com `profile.id` que vem de `useAuth` — preciso verificar se esse é o profile ID ou auth ID.

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/RelatoriosPage.tsx` | Remover OperatorRanking, corrigir mapeamento de profiles usando `user_id` |
| `src/components/relatorios/PrestacaoContas.tsx` | Ajustar para usar `user_id` como chave de operador |
| `src/hooks/useGamificationTrigger.ts` | Adicionar atualização de scores das campanhas ativas |

