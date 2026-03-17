

# Fix: Seed dos defaults mesmo com registros existentes

## Problema
O banco tem apenas 1 registro ("Cliente Seu Madruga"). A lógica de seed verifica `types.length === 0`, então como já existe 1 registro, os 5 defaults nunca são inseridos.

## Solução

### 1. `src/services/dispositionService.ts` — usar upsert no seed
Alterar `seedDefaultDispositionTypes` para usar **upsert** com `onConflict: 'tenant_id,key'` em vez de `insert`. Assim, se os defaults já existirem, não duplica; se não existirem, insere.

### 2. `src/components/cadastros/CallDispositionTypesTab.tsx` — corrigir condição do seed
Mudar a condição de `types.length === 0` para verificar se **faltam keys defaults**:
```typescript
const missingDefaults = DEFAULT_DISPOSITION_LIST.some(
  d => !types.find(t => t.key === d.key)
);
```
Se `missingDefaults` for true e `!seeded`, executar o seed (upsert). Após o seed, invalidar a query para recarregar a lista completa (5 defaults + "Cliente Seu Madruga").

### Resultado esperado
A aba mostrará 6 registros: os 5 padrões + "Cliente Seu Madruga", todos editáveis.

