## Validação contra `docs/README.md` e `docs/IA_BOUNDARIES.md`

### ✅ O que está conforme

1. **`src/services/goalService.ts`** — cabeçalho `⚠ ARQUIVO CRÍTICO` presente. `fetchGoals` e `fetchMyGoals` aplicam corretamente `mode === "global" → is("credor_id", null)` e `mode === "per_credor" → not("credor_id", "is", null)`. `fetchTenantGoalsMode` lê `tenants.settings.goals_mode` com default seguro `"global"`. Multi-tenant respeitado em todas as queries (`.eq("tenant_id", tid)`).

2. **`src/components/gamificacao/GoalsManagementTab.tsx`** — toggle Global × Per Credor persiste via `setTenantGoalsMode` e invalida as queryKeys exigidas pela Regra 7 (`tenant-goals-mode`, `goals`, `goals-all-credores`, `dash-meta-goals-all`, `dash-meta-my-goals`). Coluna "Total (todos credores)" calculada via `subtotalMap` apenas em modo per_credor — não há soma cruzada com global.

3. **`docs/README.md`** — Regras 1–8 todas presentes, incluindo a Regra 7 (Modo de Metas) que documenta o bug dos R$ 255.000 e proíbe somar os dois grupos.

4. **`docs/IA_BOUNDARIES.md`** — matriz de responsabilidade publicada, lista de arquivos críticos correta.

### ⚠ Inconsistência detectada (única)

**`src/pages/DashboardPage.tsx` não passa a prop `tenantId` para `<DashboardMetaCard />`.**

- `DashboardMetaCard` declara `tenantId: string | null` como **obrigatório** na interface e usa essa prop para:
  - habilitar a query `tenant-goals-mode` (`enabled: !!tenantId`),
  - passar para `fetchMyGoals` / `fetchGoals` (multi-tenant — Regra 1).
- Sem essa prop, o card cai no fallback `mode = "global"` por padrão e o `fetchGoals`/`fetchMyGoals` resolve o tenant via `getMyTenantId()` interno. **Funciona por sorte**, mas viola o contrato (TypeScript deveria estar reclamando — provavelmente está, ou a prop foi removida indevidamente em algum merge).
- Risco: se um admin estiver em modo de suporte (impersonando outro tenant via `useEffectiveTenantId`), o card vai mostrar a meta do **tenant do próprio usuário**, não do tenant impersonado → regressão silenciosa.

### Correção proposta (mínima, 1 linha)

Em `src/pages/DashboardPage.tsx`, no JSX do `<DashboardMetaCard ... />`, adicionar:

```tsx
tenantId={effectiveTenantId}
```

Nada mais muda. Sem schema, sem RLS, sem lógica nova — só restaurar o contrato da prop que estava no design original.

### Recomendação de protocolo (não-código)

Para evitar que isso se repita, sugiro acrescentar ao `docs/IA_BOUNDARIES.md` uma linha curta na seção "Procedimento de sincronização":

> 5. Quando uma prop for marcada `⚠ ARQUIVO CRÍTICO` como obrigatória (ex.: `tenantId`), nenhuma IA pode removê-la do callsite sem registrar em `docs/README.md` o motivo.

### Resposta direta

- **Tudo o que mudou nas Metas (modo Global × Per Credor) está conforme o protocolo**, exceto o callsite em `DashboardPage.tsx` que esqueceu de passar `tenantId`.
- Aprove para eu aplicar a correção de 1 linha + a nota de protocolo. Sem qualquer outra alteração.
