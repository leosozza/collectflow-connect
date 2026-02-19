
## Corrigir Fluxo de Login/Logout de Campanha do Operador na Telefonia 3CPlus

### Problema Identificado

O endpoint `POST /agents/{agent-id}/login` usado atualmente **nao existe** na API 3CPlus (retorna 404). A API 3CPlus exige que o login seja feito via `POST /agent/login` usando o **token individual do agente**, nao o token administrativo da empresa.

### Solucao

A API 3CPlus expoe os tokens individuais de cada agente pelo endpoint `GET /users` (acessivel com o token admin). O proxy precisa:

1. Buscar o token do agente via `GET /users`
2. Usar esse token para chamar `POST /agent/login` com `{ campaign_id }` no body
3. Para logout, usar `POST /agent/logout` com o token do agente (em vez do endpoint company-level)

### Mudancas Necessarias

#### 1. Edge Function: `threecplus-proxy/index.ts`

Modificar os actions `login_agent_to_campaign` e adicionar `logout_agent_self`:

**`login_agent_to_campaign`** (corrigido):
- Recebe `agent_id` e `campaign_id`
- Faz GET `/users` com o admin token para buscar a lista de usuarios
- Encontra o usuario cujo `id === agent_id` e extrai seu `api_token`
- Faz POST `/agent/login` usando o token do agente, com body `{ campaign_id }`

**`logout_agent_self`** (novo action):
- Recebe `agent_id`
- Busca o token do agente da mesma forma (GET `/users`)
- Faz POST `/agent/logout` usando o token do agente

Tambem corrigir `agent_available_campaigns`:
- Endpoint atual `GET /agents/{agent_id}/campaigns` nao existe
- Correto: `GET /agent/campaigns` usando o token do agente

#### 2. Frontend: `TelefoniaDashboard.tsx`

Ajustes menores:
- Alterar `handleCampaignLogout` para usar o novo action `logout_agent_self` em vez de `logout_agent`
- Melhorar tratamento de erro para mostrar mensagens mais claras
- Verificar se `status: 0` (offline) e corretamente identificado para mostrar o seletor de campanha

### Detalhes Tecnicos

```text
Fluxo Login (corrigido):
  Frontend -> invoke("login_agent_to_campaign", { agent_id, campaign_id })
     |
     v
  Edge Function:
     1. GET /users?api_token=ADMIN_TOKEN -> lista usuarios
     2. Encontra usuario com id === agent_id -> extrai agent_api_token
     3. POST /agent/login?api_token=AGENT_TOKEN  body: { campaign_id }
     |
     v
  3CPlus: agente logado na campanha

Fluxo Logout (corrigido):
  Frontend -> invoke("logout_agent_self", { agent_id })
     |
     v
  Edge Function:
     1. GET /users?api_token=ADMIN_TOKEN -> lista usuarios
     2. Encontra usuario com id === agent_id -> extrai agent_api_token
     3. POST /agent/logout?api_token=AGENT_TOKEN
     |
     v
  3CPlus: agente deslogado
```

### Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Corrigir `login_agent_to_campaign`, adicionar `logout_agent_self`, corrigir `agent_available_campaigns` |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Usar `logout_agent_self` no handleCampaignLogout, tratar status 0 como offline |

### Consideracoes de Seguranca

- Os tokens individuais dos agentes nunca sao expostos ao frontend
- Toda a logica de resolucao de tokens acontece dentro da edge function
- O frontend continua enviando apenas `agent_id` e `campaign_id`
- O admin token e usado somente para buscar os tokens dos agentes no servidor
