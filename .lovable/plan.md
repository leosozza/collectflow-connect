

# Plano: Corrigir campos inteiros na API 3CPlus

## Problema

Os logs da edge function mostram erro 422 em todas as qualificações:
```
"behavior":["O campo Comportamento deverá conter um número inteiro."]
```

O campo `behavior` está sendo enviado como string (`"repetir"`, `"nao_discar_cliente"`) mas a API 3CPlus exige um **inteiro**. Provavelmente `positive_impact` e `blocklist_time_type` também precisam ser inteiros.

## Mapeamento correto (strings RIVO -> inteiros 3CPlus)

| Campo RIVO | Valor enviado (errado) | Valor correto |
|---|---|---|
| `behavior: "repetir"` | `"repetir"` | `3` |
| `behavior: "nao_discar_telefone"` | `"nao_discar_telefone"` | `1` |
| `behavior: "nao_discar_cliente"` | `"nao_discar_cliente"` | `2` |
| `positive_impact: true/false` | `true/false` | `1` / `0` |
| `blocklist_time_type: "indeterminate"` | `"indeterminate"` | `1` |
| `blocklist_time_type: "custom"` | `"custom"` | `2` |

## Mudança

### `supabase/functions/threecplus-proxy/index.ts` — Função `buildQualPayload`

Adicionar mapeamento de strings para inteiros na função `buildQualPayload`:

```typescript
const BEHAVIOR_MAP: Record<string, number> = {
  'nao_discar_telefone': 1,
  'nao_discar_cliente': 2,
  'repetir': 3,
};

const BLOCKLIST_MODE_MAP: Record<string, number> = {
  'indeterminate': 1,
  'custom': 2,
};
```

E converter os campos:
- `behavior` -> `BEHAVIOR_MAP[disp.behavior] || 3`
- `positive_impact` -> `disp.impact === 'positivo' ? 1 : 0`
- `blocklist_time_type` -> `BLOCKLIST_MODE_MAP[disp.blocklist_mode] || 1`

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Converter `behavior`, `positive_impact` e `blocklist_time_type` de strings/booleans para inteiros |

