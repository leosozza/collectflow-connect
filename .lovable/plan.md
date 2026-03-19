

# Plano: Corrigir parsing da lista de usuários no threecplus-proxy

## Problema identificado

A edge function `threecplus-proxy` tem uma **inconsistência crítica** na forma como busca o token do agente na API 3CPlus. A API retorna dados paginados no formato Laravel: `{ data: { data: [...users...], current_page: 1, ... } }`.

O `click2call` (que funciona) usa:
```text
per_page: '500'
usersData?.data?.data  (3 níveis: response.data.data)
```

Mas `connect_agent`, `login_agent_to_campaign`, `logout_agent_self`, `pause_agent`, `unpause_agent`, `qualify_call`, `hangup_call` e `agent_available_campaigns` usam:
```text
sem per_page (paginação default)
usersData?.data  (2 níveis: response.data) → retorna um OBJETO, não um array
```

Resultado: `.find()` é chamado sobre um objeto em vez de um array, o agente nunca é encontrado, e o `connect_agent` retorna silenciosamente o erro "Agente não encontrado ou sem token de API". O MicroSIP nunca é chamado.

Isso pode ter começado a falhar após a API 3CPlus mudar o formato de resposta ou após o número de usuários ultrapassar o limite de paginação padrão.

## Mudança

### `supabase/functions/threecplus-proxy/index.ts`

1. **Criar uma função helper** `resolveAgentToken(baseUrl, authParam, agentId)` que:
   - Busca GET /users com `per_page=500`
   - Faz parsing correto: `data?.data?.data || data?.data || data` (suporta ambos os formatos)
   - Retorna `{ api_token, extension }` ou `null`

2. **Substituir o código duplicado** em todas as 8 actions que resolvem token de agente para usar esta helper

### Actions afetadas

| Action | Linha aprox. |
|---|---|
| `login_agent_to_campaign` | ~611 |
| `connect_agent` | ~645 |
| `logout_agent_self` | ~674 |
| `agent_available_campaigns` | ~704 |
| `pause_agent` | ~734 |
| `unpause_agent` | ~765 |
| `qualify_call` | ~793 |
| `hangup_call` | ~867 |

### Função helper (adicionada no topo do arquivo)

```typescript
async function resolveAgentToken(baseUrl: string, authParam: string, agentId: number | string) {
  const url = buildUrl(baseUrl, 'users', authParam, { per_page: '500' });
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) return null;
  const raw = await res.json();
  // Support both paginated { data: { data: [...] } } and flat [...] or { data: [...] }
  const list = (raw?.data?.data && Array.isArray(raw.data.data))
    ? raw.data.data
    : Array.isArray(raw?.data) ? raw.data
    : Array.isArray(raw) ? raw : [];
  const numId = Number(agentId);
  return list.find((u: any) => u.id === numId || Number(u.id) === numId) || null;
}
```

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Criar helper `resolveAgentToken` e substituir parsing em 8 actions |

