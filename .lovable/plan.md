

## Testar e Finalizar o Fluxo de Campanha do Operador na Telefonia 3CPlus

### Problema Identificado

Ao analisar o codigo, identifiquei um problema critico na arquitetura atual:

A API 3CPlus v1 diferencia **endpoints de empresa** (company-level) e **endpoints de agente** (agent-level). Atualmente, todos os endpoints usam o mesmo `api_token` da empresa, mas os endpoints de agente (`agent/login`, `agent/logout`, `agent/campaigns`, `manual_call/*`) requerem autenticacao **do proprio agente**.

Existem duas abordagens possiveis:

**Opcao A — Usar endpoints de empresa para gerenciar agentes (recomendada)**
Em vez de chamar `agent/login` (que requer token do agente), usar os endpoints de empresa que ja funcionam com o token atual:
- Login: `POST /agents/{agent_id}/login` com `{ campaign_id }` (endpoint company-level)
- Logout: `POST /agents/{agent_id}/logout` (endpoint company-level, ja existe como `logout_agent`)

**Opcao B — Armazenar token individual do agente**
Cada operador teria seu proprio `api_token` salvo no perfil. Isso adiciona complexidade desnecessaria.

### Plano de Implementacao (Opcao A)

---

#### 1. Edge Function — Adicionar acao `login_agent_to_campaign`

Criar uma nova acao no `threecplus-proxy` que usa o endpoint company-level para logar um agente especifico em uma campanha:

```
case 'login_agent_to_campaign':
  // Requer agent_id e campaign_id
  POST /agents/{agent_id}/login  com body { campaign_id }
```

Isso permite que o proxy use o token da empresa (que ja funciona) para logar o agente.

#### 2. Edge Function — Renomear logica de logout

O `logout_agent` ja existe e funciona (`POST /agents/{agent_id}/logout`). O operador pode usar essa mesma acao passando seu proprio `agent_id`.

#### 3. TelefoniaDashboard.tsx — Ajustar `handleCampaignLogin`

Mudar de:
```typescript
await invoke("agent_login", { campaign_id: Number(selectedCampaign) });
```
Para:
```typescript
await invoke("login_agent_to_campaign", { 
  agent_id: operatorAgentId, 
  campaign_id: Number(selectedCampaign) 
});
```

#### 4. TelefoniaDashboard.tsx — Ajustar `handleCampaignLogout`

Mudar de:
```typescript
await invoke("agent_logout_self");
```
Para:
```typescript
await invoke("logout_agent", { agent_id: operatorAgentId });
```

Isso reutiliza a acao `logout_agent` que ja existe e funciona com o token da empresa.

#### 5. Buscar campanhas disponiveis para o agente

Adicionar uma acao `agent_available_campaigns` no proxy que consulta as campanhas onde o agente pode logar. A API 3CPlus tem o endpoint `GET /agents/{agent_id}/campaigns` (company-level) que retorna campanhas disponiveis para aquele agente especifico. Se esse endpoint nao existir, o `list_campaigns` ja atende.

#### 6. Validacao no frontend

- Verificar que `operatorAgentId` existe antes de permitir login/logout
- Tratar erros especificos da API (agente ja logado, campanha inativa)
- Apos login bem-sucedido, forcar refresh para mostrar o card de status atualizado
- Apos logout, voltar para a tela de selecao de campanha

---

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar acao `login_agent_to_campaign` usando `POST /agents/{agent_id}/login` |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Ajustar `handleCampaignLogin` e `handleCampaignLogout` para usar acoes company-level com `operatorAgentId` |

### Resumo das mudancas

- Trocar 2 chamadas de endpoint (agent-level para company-level)
- Adicionar 1 nova acao no proxy
- Zero mudancas no banco de dados
- Zero novas dependencias

### Resultado esperado

1. Operador acessa a aba Telefonia e ve campanhas disponiveis
2. Seleciona uma campanha e clica "Entrar na Campanha"
3. O proxy usa o token da empresa para logar o agente via `POST /agents/{agent_id}/login`
4. Apos refresh, o card de status aparece com nome, ramal, campanha e metricas
5. Operador pode sair clicando "Sair da Campanha" (usa `logout_agent` existente)
6. Apos logout, volta para a tela de selecao

