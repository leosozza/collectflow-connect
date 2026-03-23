

# Plano: Corrigir vinculação de agentes em campanhas

## Diagnóstico

Testei a API 3CPlus diretamente e confirmei o problema:

- O proxy envia `{ users: [86498] }` mas a API 3CPlus espera `{ agents: [86498] }`
- Resposta da API: **422** — `"O campo agents é obrigatório."`

Ou seja, é um erro simples de nome de campo no payload.

## Correção

### `supabase/functions/threecplus-proxy/index.ts`

Linha 180 — trocar:
```typescript
reqBody = JSON.stringify({ users: body.agent_ids });
```
por:
```typescript
reqBody = JSON.stringify({ agents: body.agent_ids });
```

**Um único caractere corrige o problema inteiro.**

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Trocar `users` → `agents` no payload de `add_agents_to_campaign` |

