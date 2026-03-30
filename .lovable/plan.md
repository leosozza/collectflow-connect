

# Plano: Corrigir filtro de usuários ativos

## Causa raiz

A API 3CPlus retorna `"active": 1` (ativo) e `"active": 0` (inativo) — valores numéricos. A função `isUserActive` usa comparação estrita (`u.active === false`), que não captura `0` como falso.

Exemplo: Camila tem `"active": 0` mas `0 === false` retorna `false` em JavaScript, então a função retorna `true` e ela aparece como "Ativa".

## Correção

**Arquivo**: `src/lib/threecplusUtils.ts`

Alterar `isUserActive` para tratar valores numéricos:

```typescript
export function isUserActive(u: any): boolean {
  if (u.active === false || u.active === 0) return false;
  if (u.is_active === false || u.is_active === 0) return false;
  if (u.status === "inactive" || u.status === "disabled") return false;
  if (u.deleted_at != null) return false;
  return true;
}
```

Uma mudança de 2 linhas. Nenhum outro arquivo precisa ser alterado.

