

# Plano: Revisão completa da tela /contact-center/telefonia

## Problemas identificados

### 1. Pausa/Retomar — proxy correto, mas sem body no POST
Os endpoints no proxy estão corretos (`/agent/work_break/{id}/enter` e `/agent/work_break/exit`). Porém, o `POST` para `/agent/work_break/{id}/enter` pode exigir um body vazio `{}` explícito, e o proxy não envia nenhum body (`reqBody` fica `undefined`). Quando `reqBody` é undefined, o `fetch` não inclui `body` na requisição, o que em alguns servidores resulta em `Content-Length: 0` sem `Content-Type`, podendo causar rejeição.

**Correção:** Adicionar `reqBody = JSON.stringify({})` nos cases `pause_agent` e `unpause_agent`.

### 2. Polling excessivo — 7+ requests a cada 10 segundos
O operador tem `interval = 10` segundos. Cada ciclo de `fetchAll` faz:
- `agents_status` (1 request)
- `list_campaigns` (1 request)
- `company_calls` (1 request)
- `agent_available_campaigns` (1 request)
- `campaign_statistics` para **cada campanha ativa** (4-6 requests)

Total: ~8-9 requests a cada 10 segundos. Isso é excessivo e pode causar rate limiting na API 3CPlus.

**Correção:** Para operadores, não chamar `list_campaigns` (já tem `agent_available_campaigns`) nem `campaign_statistics` (não é relevante para o operador). Reduzir o fetch do operador para apenas `agents_status`, `company_calls` e `agent_available_campaigns`.

### 3. `handleCampaignLogin` chama `connect_agent` automaticamente
Após login na campanha, o sistema chama `connect_agent` automaticamente (linhas 479-493). Se o MicroSIP não estiver pronto, isso gera aviso desnecessário. Como vocês usam MicroSIP na operação, manter, mas melhorar a mensagem de erro para ser mais clara.

### 4. Botões Mic e Keyboard desabilitados sem funcionalidade
Na barra de status (linhas 852-858), há dois botões `disabled` para Mic e Keyboard que não fazem nada. São confusos para o operador.

**Correção:** Remover os botões inativos da barra de status.

### 5. Timer do status reinicia quando `fetchAll` atualiza `agents`
O `useEffect` do timer (linha 426) depende de `myAgent?.status_start_time`. Como `setAgents` é chamado a cada polling, o referência do `myAgent` muda (novo objeto), disparando o effect e recriando o interval. Embora o `calcSeconds()` re-calcule corretamente, o intervalo é destruído e recriado desnecessariamente 8x por minuto.

**Correção:** Usar `useMemo` para extrair `status_start_time` como valor primitivo no deps array.

### 6. `OperatorCallHistory` — ligações sem `onClickToCall`
O componente é renderizado sem a prop `onClickToCall` (linha 922), então o botão "Ligar" nunca aparece na tabela de histórico.

**Correção:** Passar callback que abre o DialPad ou faz click2call.

### 7. Widget flutuante não fecha ao sair da campanha
Quando o operador clica "Sair da Campanha", `handleCampaignLogout` não chama `closeAtendimento()`. O widget permanece aberto em modo "Aguardando ligação" mesmo após logout.

**Correção:** Chamar `closeAtendimento()` após logout bem-sucedido.

## Mudanças

### `supabase/functions/threecplus-proxy/index.ts`
- `pause_agent` (linha 748): Adicionar `reqBody = JSON.stringify({})` antes do break
- `unpause_agent` (linha 764): Adicionar `reqBody = JSON.stringify({})` antes do break

### `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`
1. **Otimizar `fetchAll` para operadores** — quando `isOperatorView`, pular `list_campaigns` e `campaign_statistics`; buscar apenas `agents_status`, `company_calls` e `agent_available_campaigns`
2. **Remover botões Mic/Keyboard** da barra de status (linhas 852-858)
3. **Fechar widget no logout** — em `handleCampaignLogout`, chamar `closeAtendimento()` após sucesso
4. **Estabilizar timer deps** — extrair `myAgent?.status_start_time` como variável primitiva
5. **Passar `onClickToCall`** ao `OperatorCallHistory` (usando `invoke("click2call", ...)`)

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar body vazio no POST de pause/unpause |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Otimizar polling do operador, remover botões inativos, fechar widget no logout, estabilizar timer, passar onClickToCall |

