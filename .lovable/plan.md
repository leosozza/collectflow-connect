

## Plano: 3 correções

### 1. Corrigir erro "column operator_goals_unique_idx does not exist"

**Causa**: O `onConflict` do Supabase JS espera nomes de colunas separados por vírgula, não nome de índice. Além disso, o índice usa `COALESCE(credor_id, ...)` que não pode ser expresso como coluna simples.

**Solução**: Trocar o upsert por uma lógica de "buscar existente → insert ou update".

**Arquivo: `src/services/goalService.ts`** — função `upsertGoal`:
- Buscar registro existente com `operator_id + year + month + credor_id`
- Se existir: `update` pelo `id`
- Se não existir: `insert`

### 2. Adicionar critério "Acordos Formalizados" nos templates de conquista

**Arquivo: `src/services/achievementTemplateService.ts`**
- Adicionar `{ value: "agreements_count", label: "Qtd. de acordos formalizados" }` ao array `CRITERIA_OPTIONS`

### 3. Nenhuma alteração de banco necessária

O campo `criteria_type` já é `text` livre, então aceita o novo valor `agreements_count` sem migração.

