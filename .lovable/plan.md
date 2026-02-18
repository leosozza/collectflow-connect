

## Campanhas disponíveis para o Operador na Telefonia

### Contexto atual
Na visao de operador (`isOperatorView`), o `TelefoniaDashboard` mostra apenas o card do agente e o DialPad. Nao ha como o operador escolher em qual campanha entrar. As campanhas sao criadas pelo Admin no painel de Campanhas, mas o operador nao tem acesso a elas.

### O que sera feito

Adicionar um seletor de campanhas na visao do operador, permitindo que ele veja as campanhas disponiveis e faca login/logout em uma campanha via API 3CPlus.

---

### 1. Adicionar endpoints no proxy (`threecplus-proxy`)

Dois novos actions no edge function:

- **`agent_login`** — `POST /agent/login` com body `{ campaign_id }` — Loga o agente na campanha selecionada
- **`agent_logout_self`** — `POST /agent/logout` — Desloga o proprio agente
- **`agent_campaigns`** — `GET /agent/campaigns` — Lista campanhas que o agente pertence

### 2. Componente de selecao de campanha no operador

Na visao do operador em `TelefoniaDashboard.tsx`:

- Quando o agente **nao esta online** (myAgent === null), mostrar um card com:
  - Select de campanhas (carregadas via `list_campaigns`)
  - Botao "Entrar na Campanha" que chama `agent_login` com o `campaign_id` selecionado
- Quando o agente **esta online**, o card atual continua igual mas com um botao "Sair da Campanha" que chama `agent_logout_self`

### 3. Fluxo do operador

```text
1. Operador acessa Telefonia
2. Se nao esta logado -> ve o seletor de campanhas + botao "Entrar"
3. Seleciona a campanha e clica "Entrar"
4. Apos login, o dashboard atualiza e mostra o card com status + DialPad
5. Pode clicar "Sair da Campanha" para deslogar
```

---

### Detalhes tecnicos

**Arquivo: `supabase/functions/threecplus-proxy/index.ts`**

Adicionar 3 novos cases no switch:

```typescript
case 'agent_login': {
  const err = requireField(body, 'campaign_id', corsHeaders);
  if (err) return err;
  url = buildUrl(baseUrl, 'agent/login', authParam);
  method = 'POST';
  reqBody = JSON.stringify({ campaign_id: body.campaign_id });
  break;
}

case 'agent_logout_self':
  url = buildUrl(baseUrl, 'agent/logout', authParam);
  method = 'POST';
  break;

case 'agent_campaigns':
  url = buildUrl(baseUrl, 'agent/campaigns', authParam);
  break;
```

**Arquivo: `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`**

Na secao `OPERATOR VIEW` (linhas 210-313):

- Adicionar estado `selectedCampaign` e `loggingIn`
- Carregar campanhas com o `fetchAll` existente (ja carrega `campaigns`)
- Quando `!myAgent`:
  - Mostrar card com Select de campanhas + botao "Entrar na Campanha"
  - Ao clicar, chamar `invoke("agent_login", { campaign_id })` e depois `fetchAll()`
- Quando `myAgent` esta online:
  - Adicionar botao discreto "Sair da Campanha" no card do agente
  - Ao clicar, chamar `invoke("agent_logout_self")` e depois `fetchAll()`

---

### Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | 3 novos actions: `agent_login`, `agent_logout_self`, `agent_campaigns` |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Seletor de campanhas + login/logout na visao operador |

### Nenhuma migracao de banco necessaria.
### Nenhuma nova dependencia necessaria.

