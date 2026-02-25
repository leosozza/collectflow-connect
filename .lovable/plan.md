

## Plano: Unificar Telefonia Preditiva + Atendimento e Auto-Tabular no 3CPlus

### Contexto Atual

Hoje existem duas telas separadas:
- `/contact-center/telefonia` — Operador ve seu card de status, login/logout de campanha, pausas. Nao tem como tabular nem negociar.
- `/atendimento/:id` — Tela de atendimento com dados do cliente, tabulacao, negociacao, timeline. Precisa navegar manualmente.

A discagem preditiva do 3CPlus conecta o operador automaticamente a um cliente. Mas hoje nao ha integracao entre a chamada recebida e a tela de atendimento. Alem disso, a tabulacao no Rivo nao reflete no 3CPlus.

### O Que Vai Mudar

```text
┌─────────────────────────────────────────────────────────┐
│  /contact-center/telefonia  (tela unificada)            │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │ Painel Operador  │  │ AtendimentoEmbutido          │ │
│  │ - Status agente  │  │ - ClientHeader               │ │
│  │ - Login campanha │  │ - DispositionPanel           │ │
│  │ - Pausa/Retomar  │  │ - NegotiationPanel           │ │
│  │ - Script         │  │ - ClientTimeline             │ │
│  └──────────────────┘  │                              │ │
│                        │  (carregado via phone lookup) │ │
│                        └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Alteracoes Detalhadas

---

#### 1. Proxy 3CPlus — Novo action `qualify_call`

**Arquivo: `supabase/functions/threecplus-proxy/index.ts`**

Adicionar case para `qualify_call`:
- Recebe: `agent_id`, `call_id`, `qualification_id`
- Resolve o `api_token` do agente (mesmo pattern de login/logout)
- Chama `POST /agent/call/{call_id}/qualify` com body `{ qualification_id }`
- Permite que o Rivo tabule a chamada ativa no 3CPlus automaticamente

---

#### 2. Mapeamento de Tabulacoes — Configuracao no Tenant Settings

**Arquivo: `src/services/dispositionService.ts`**

Adicionar funcao `qualifyOn3CPlus` que:
- Recebe `dispositionType`, `tenantSettings`, `agentId`
- Busca o mapeamento `threecplus_disposition_map` dos settings do tenant (um objeto `{ voicemail: 123, no_answer: 456, ... }`)
- Se existir mapeamento para o tipo, invoca `threecplus-proxy` com action `qualify_call`
- Se nao existir, ignora silenciosamente (sem bloquear o fluxo)

---

#### 3. Tela Unificada do Operador — Telefonia + Atendimento

**Arquivo: `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`**

Na visao do operador (`isOperatorView`):

- Quando o agente estiver online e em chamada (status 2 / `on_call`):
  - Buscar o cliente pelo telefone da chamada (`myAgent.phone` ou `myAgent.remote_phone`)
  - Ao encontrar, exibir ao lado do card do operador os componentes de atendimento:
    - `ClientHeader` (compacto)
    - `DispositionPanel` — ao tabular, chama TANTO o `createDisposition` do Rivo QUANTO o `qualify_call` no 3CPlus
    - `NegotiationPanel` (quando operador clica "Negociar")
    - `ClientTimeline`
  - Se nao encontrar cliente pelo telefone, mostrar mensagem "Cliente nao encontrado no CRM"

- Quando o agente NAO estiver em chamada:
  - Manter a interface atual (card status + login campanha + pausas)
  - Mostrar o ScriptPanel normalmente

---

#### 4. Componente `TelefoniaAtendimento` (novo)

**Arquivo: `src/components/contact-center/threecplus/TelefoniaAtendimento.tsx`**

Componente que encapsula a logica de atendimento dentro da telefonia:
- Recebe: `clientPhone`, `agentId`, `callId` (quando disponivel)
- Busca o cliente pelo telefone (query por ultimos 8 digitos)
- Busca registros do CPF, disposicoes, acordos, mensagens (mesma logica do AtendimentoPage)
- Renderiza ClientHeader, DispositionPanel, NegotiationPanel, ClientTimeline
- Ao tabular:
  1. Salva no Rivo (`createDisposition`)
  2. Executa automacoes pos-tabulacao (`executeAutomations`)
  3. Qualifica no 3CPlus (`qualify_call`) usando mapeamento do tenant

---

#### 5. AtendimentoPage — Tambem auto-tabula no 3CPlus

**Arquivo: `src/pages/AtendimentoPage.tsx`**

Na funcao `handleDisposition`:
- Apos salvar a tabulacao no Rivo, verificar se o operador tem `threecplus_agent_id` e se o tenant tem credenciais 3CPlus
- Se sim, chamar `qualify_call` no proxy (melhor esforco, sem bloquear)
- Isso garante que mesmo ao atender via carteira, a tabulacao reflita no 3CPlus

---

#### 6. Configuracao do Mapeamento de Qualificacoes

**Arquivo: `src/pages/IntegracaoPage.tsx` ou `src/components/integracao/ThreeCPlusTab.tsx`**

Na aba de configuracao do 3CPlus, adicionar secao "Mapeamento de Tabulacoes":
- Busca as qualificacoes cadastradas no 3CPlus (via `list_qualifications`)
- Para cada tipo de disposicao do Rivo (voicemail, no_answer, etc.), permite selecionar a qualificacao correspondente no 3CPlus
- Salva no `tenant.settings.threecplus_disposition_map`

---

### Resumo dos Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar action `qualify_call` |
| `src/services/dispositionService.ts` | Adicionar `qualifyOn3CPlus()` |
| `src/components/contact-center/threecplus/TelefoniaAtendimento.tsx` | **Novo** — atendimento embutido na telefonia |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Integrar TelefoniaAtendimento na visao operador |
| `src/pages/AtendimentoPage.tsx` | Chamar `qualifyOn3CPlus` apos tabulacao |
| `src/components/integracao/ThreeCPlusTab.tsx` | Adicionar config de mapeamento de qualificacoes |

