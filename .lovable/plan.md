

## Plano: Corrigir exibição de metas do operador + Gauge visual

### Problema identificado

Bug critico: O admin salva metas com `operator_id = profiles.id`, mas `fetchMyGoal` busca com `auth.uid()` (que é `user_id`, campo diferente). O RLS também usa `auth.uid()`, então nunca encontra a meta do operador.

### Alterações

#### 1. `src/services/goalService.ts` — Corrigir fetchMyGoal
Usar `profile.id` em vez de `user.id`. Buscar o profile primeiro e usar o `profiles.id` como `operator_id`.

```typescript
// Antes: .eq("operator_id", user.id)  ← auth.uid, errado
// Depois: buscar profile.id via profiles.user_id = user.id, 
//         e filtrar .eq("operator_id", profile.id)
```

#### 2. RLS da tabela `operator_goals` — Corrigir policy do operador
Alterar de `operator_id = auth.uid()` para `operator_id = get_my_profile_id()` (função já existente no banco).

#### 3. `src/pages/GamificacaoPage.tsx` — Reordenar abas
Para operadores: colocar aba "Metas" como primeiro item (defaultValue="goals"). Manter a ordem atual para admins.

#### 4. `src/components/gamificacao/GoalsTab.tsx` — Gauge de acelerador
Substituir o card simples do operador por um componente visual de gauge (velocímetro) grande, com:
- Arco colorido (vermelho → amarelo → verde) desenhado com SVG
- Ponteiro indicando a porcentagem atual
- Texto "Meta Recebimento" com valor da meta
- Texto "Realizado" com valor recebido
- Período do mês (01/MM/AA à último dia/MM/AA)
- Card grande, centralizado

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/services/goalService.ts` | Corrigir `fetchMyGoal` para usar `profiles.id` |
| `src/pages/GamificacaoPage.tsx` | Aba Metas como default para operadores |
| `src/components/gamificacao/GoalsTab.tsx` | Gauge SVG grande para visualização do operador |
| Migration SQL | Corrigir RLS policy de `operator_goals` para usar `get_my_profile_id()` |

