
Plano curto para corrigir os 2 pontos:

## Diagnóstico
1. **O widget não abre ao entrar na campanha** porque hoje ele só é acionado dentro do bloco `isOnCall` em `TelefoniaDashboard.tsx`. Ou seja: sem ligação ativa, o widget nunca é aberto.
2. **O botão DESLIGAR retorna “recurso não encontrado”** porque o proxy está chamando `POST /agent/hangup`, mas a documentação da 3CPlus indica o endpoint correto como `POST /agent/call/{call-id}/hangup`.
3. **Além disso, o front nem exige `callId` para desligar** e o botão aparece com base apenas em “agente + integração configurada”, então ele pode ficar visível mesmo sem uma chamada realmente ativa.

## O que vou ajustar

### 1) Abrir o widget assim que o operador entrar na campanha
**Arquivo:** `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

- Abrir o widget **logo após login bem-sucedido na campanha**, sem esperar a ligação cair.
- Adicionar também uma **reidratação automática**: se o operador já estiver online em uma campanha após refresh/navegação, o widget volta a aparecer.
- Trocar a lógica atual “abrir só quando `isOnCall`” por uma sincronização em 2 etapas:
  - **campanha aberta** → widget flutuante aparece em modo “aguardando ligação”
  - **ligação detectada** → widget recebe `clientId/callId` e expande para atendimento

### 2) Evoluir o widget para suportar estado “sem cliente ainda”
**Arquivo:** `src/hooks/useAtendimentoModal.tsx`

- Permitir abrir o widget mesmo **sem `clientId`**.
- Adicionar estado do widget para:
  - campanha ativa / aguardando ligação
  - chamada ativa / cliente resolvido
- Quando ainda não houver cliente, mostrar uma versão compacta com status do operador e cronômetro.
- Quando a chamada cair e o cliente for identificado, atualizar o widget existente em vez de criar outro.

### 3) Corrigir o identificador da chamada
**Arquivo:** `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

- Passar um `callId` canônico para o widget usando prioridade como:
  - `activeCall.id`
  - `activeCall.call_id`
  - `myAgent.current_call_id`
  - `myAgent.call_id`
- Isso é importante porque o `company_calls` atual já traz `id: "call:..."`, e esse valor precisa chegar até o botão DESLIGAR.

### 4) Corrigir o botão DESLIGAR no front
**Arquivo:** `src/pages/AtendimentoPage.tsx`

- Alterar `handleHangup` para exigir `callId`.
- Enviar `call_id` junto com `agent_id` para o proxy.
- Mudar a regra do botão para aparecer apenas quando houver **chamada real ativa**:
  - usar `hasActiveCall={!!callId}`
  - se não houver `callId`, mostrar erro claro em vez de tentar desligar

### 5) Corrigir o endpoint no proxy 3CPlus
**Arquivo:** `supabase/functions/threecplus-proxy/index.ts`

- Trocar a ação `hangup_call` de:
  - `POST /agent/hangup`
- Para:
  - `POST /agent/call/{call-id}/hangup`
- Validar `call_id` como obrigatório.
- Manter a resolução do token do agente, mas montar a URL correta para a chamada.

## Resultado esperado
- Ao entrar na campanha, o operador já vê o **widget flutuante global** em qualquer tela.
- Quando a ligação cair, o widget é atualizado/expandido rapidamente com o atendimento.
- O botão **DESLIGAR** passa a usar o endpoint correto da 3CPlus e só aparece quando existir uma chamada válida.

## Arquivos a ajustar
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`
- `src/hooks/useAtendimentoModal.tsx`
- `src/pages/AtendimentoPage.tsx`
- `supabase/functions/threecplus-proxy/index.ts`

## Observação técnica importante
Hoje o dashboard ainda renderiza o atendimento “inline” no estado `isOnCall`. Eu vou refatorar essa parte para o dashboard atuar só como **sincronizador do widget**, evitando depender da tela atual para abrir o atendimento.
