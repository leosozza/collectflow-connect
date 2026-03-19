

# Plano: Corrigir campo `impact` na API 3CPlus

## Problema

Os logs mostram que **todas** as qualificações falham com erro 422:
```
"errors":{"impact":["O campo impact é obrigatório."]}
```

O payload envia `positive_impact: 0/1` mas a API 3CPlus espera o campo chamado **`impact`** (não `positive_impact`).

## Mudança

### `supabase/functions/threecplus-proxy/index.ts` — Função `buildQualPayload`

Renomear `positive_impact` para `impact` no payload:

```typescript
// De:
positive_impact: disp.impact === 'positivo' ? 1 : 0,

// Para:
impact: disp.impact === 'positivo' ? 1 : 0,
```

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Renomear `positive_impact` → `impact` no `buildQualPayload` |

