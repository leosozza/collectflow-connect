

## Plano: Auto-conectar MicroSIP ao entrar na campanha

### Contexto

Hoje, ao clicar "Entrar na Campanha", o Rivo chama apenas `POST /agent/login` na API 3CPlus. Isso loga o agente na campanha, mas nao aciona o softphone SIP (MicroSIP). O operador precisa ir manualmente ao 3CPlus para conectar.

A API 3CPlus tem um endpoint separado: `POST /agent/connect` que dispara a conexao SIP do agente, fazendo o MicroSIP receber a chamada de registro automaticamente.

### O Que Vai Mudar

Ao clicar "Entrar na Campanha" no Rivo, o sistema fara automaticamente:
1. `POST /agent/login` — Loga o agente na campanha (ja existe)
2. `POST /agent/connect` — Conecta o softphone SIP/MicroSIP (novo)

O operador so precisa atender a chamada no MicroSIP para ficar conectado.

### Alteracoes Detalhadas

---

#### 1. Proxy — Novo action `connect_agent`

**Arquivo: `supabase/functions/threecplus-proxy/index.ts`**

Adicionar case `connect_agent`:
- Resolve o `api_token` do agente (mesmo padrao dos demais)
- Chama `POST /agent/connect` com o token do agente
- Sem body adicional necessario (a API conecta o agente ao ramal SIP ja configurado)

---

#### 2. Login do Operador — Chamar connect apos login

**Arquivo: `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`**

Na funcao `handleCampaignLogin`:
- Apos o `login_agent_to_campaign` retornar sucesso
- Chamar `invoke("connect_agent", { agent_id: operatorAgentId })`
- Se o connect falhar, mostrar aviso (mas nao bloquear, pois o login ja funcionou)
- Mensagem de sucesso: "Conectado! Atenda o MicroSIP para iniciar."

---

### Resumo dos Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar action `connect_agent` → `POST /agent/connect` |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Chamar `connect_agent` automaticamente apos login na campanha |

### Detalhes Tecnicos

- O endpoint `POST /agent/connect` usa o `api_token` do agente (nao o token da empresa), seguindo o mesmo padrao de resolucao ja usado em `login_agent_to_campaign`
- O MicroSIP deve estar instalado e configurado no PC do operador com as credenciais SIP do 3CPlus — isso e pre-requisito externo, nao depende do Rivo
- Apos o connect, o 3CPlus envia uma chamada SIP para o ramal do agente; o operador atende e fica disponivel para receber ligacoes preditivas

