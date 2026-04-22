

## Correções: ficha não abre na ligação + pausa travada

### Causa 1 — Ficha não abre quando entra ligação

Olhando o screenshot do Gustavo "Em ligação (00:27)", a barra vermelha aparece mas o que está abaixo são as KPIs/Últimas Ligações da tela de espera, não a ficha. Isso significa que o ramo `if (isOnCall && (activeCallPhone || mailingCpf || mailingClientId))` em `TelefoniaDashboard.tsx:1073` **não foi acionado** — `isOnCall` ficou `true` mas **as 3 fontes de identificação ficaram vazias** ao mesmo tempo.

Por quê: o estado `companyCalls` é populado pelo polling de `fetchAll` (a cada 3s no operatorView). Existe uma janela em que `myAgent.status` já virou `2` (on_call), mas `company_calls` ainda não devolveu o registro da chamada nova → `activeCall=null`, `mailingCpf=""`, `mailingClientId=""`, `activeCallPhone=""` (porque também não há `myAgent.phone`/`remote_phone` ainda). Resultado: cai no `else` e renderiza a tela "Logged in, waiting" mesmo com a barra "Em ligação".

Ainda pior: quando finalmente `activeCall` chega, o `TelefoniaAtendimentoWrapper` faz `useClientByPhone` + query CPF; se as duas devolvem `null` (cliente não existe na carteira), mostra o card "Cliente não encontrado". Não há fallback que **abra a ficha de atendimento mesmo sem cliente cadastrado** com base no telefone bruto. Em discadores preditivos sem mailing rico, isso é a regra, não a exceção.

**Correção:**
1. Em `isOnCall`, **sempre renderizar `TelefoniaAtendimentoWrapper`**, mesmo sem identificadores ainda — passa `clientPhone=""` e o wrapper mostra um loader "Aguardando dados da chamada..." enquanto polling completa.
2. No wrapper, quando a busca termina sem cliente E há um `clientPhone` válido, **navegar automaticamente** para `/atendimento?phone=...&agentId=...&callId=...&channel=call` (em vez de exigir clique no botão). A página de atendimento já trata cliente novo via querystring.
3. Forçar fetch imediato de `company_calls` na transição `prevStatus !== 2 → 2` (não esperar próximo tick de 3s) — adicionar `fetchAll()` no `useEffect` de detecção de transição.

### Causa 2 — Pausa travada sem botão "Retomar"

Screenshot "Em pausa (04:04)" mostra só botão "Intervalo" (que abre o popover de motivos), sem o botão "Retomar". Na lógica linha 1214: `isManualPause` precisa de `(status===3 com activePauseName)` **OU** `status===6`. Se o operador foi pausado externamente (admin pausou, ou pausa veio com status 3 sem nome reconhecível) e o `sessionStorage` está vazio (ex: reload da página, outra aba), `activePauseName=""` e `status=3` → `isManualPause=false` → mostra "Intervalo" em vez de "Retomar". Operador clica no Intervalo, não vê opção de sair, fica preso.

**Correção:**
1. Tratar `status===3` **sempre** como pausa manual (independente de `activePauseName`). Pausa real do servidor é status 3; status 4 (TPA) já tem fluxo próprio. Ajustar `isManualPause` para `status===3 || status===6 || (string equivalents)`, sem exigir `activePauseName`.
2. No `useEffect` de detecção de pausa externa (linha 812), quando entra em status 3 sem `activePauseName`, definir `setActivePauseName("Pausa")` como label genérico para o header não ficar inconsistente.
3. Adicionar **botão de emergência "Forçar saída de pausa"** no header sempre que `isPaused===true` por mais de 60s — chama `unpause_agent` direto e, se a 3CPlus responder "não está em pausa", limpa estado local. Já existe esse caminho de erro tratado em `handleUnpause`, só falta expor o botão de forma visível.

### Causa 3 — Defesa contra "campanha caída sem áudio"

Independente das duas correções de UI, vamos registrar telemetria mínima da chamada para o próximo diagnóstico do Gustavo: ao entrar em `isOnCall`, fazer um único `INSERT` em `client_events` com `metadata: { agent_id, call_id, phone, status_at_entry, sip_connected, extension_status }`. Isso permite, no futuro, correlacionar "ligação caiu sem áudio" com `sip_connected=false` ou `extension_status≠registered` no momento do ring.

### Arquivos alterados

- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`
  - `isManualPause` (linha 829): aceitar status 3 sem `activePauseName`.
  - `useEffect` pausa externa (linha 812): definir label genérico "Pausa" quando ausente.
  - Botão "Forçar saída de pausa" no header da pausa (próximo ao timer) quando `isPaused` há > 60s.
  - Bloco `isOnCall` (linha 1073): renderizar `TelefoniaAtendimentoWrapper` mesmo sem identificadores ainda; disparar `fetchAll()` extra na transição para status 2.
  - `useEffect` de transição (linha 484): chamar `fetchAll()` quando prevStatus → 2 para acelerar busca de `company_calls`.
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` → `TelefoniaAtendimentoWrapper`:
  - Auto-navegar para `/atendimento?phone=...` quando lookup terminar sem cliente (sem exigir clique).
  - Loader explícito "Aguardando dados da chamada..." quando `clientPhone===""`.
  - `INSERT` opcional em `client_events` ao montar com dados de telemetria SIP.

### Validação pós-deploy

1. Gustavo entra em campanha → ramo verde "Aguardando ligação".
2. Próxima ligação cai → barra vermelha aparece **e** ficha de atendimento abre em até 3s, mesmo se cliente não estiver na carteira (vai para `/atendimento?phone=...`).
3. Se admin pausar Gustavo de outra tela → header amarelo mostra **botão "Retomar"** funcional imediatamente.
4. Se ele ficar preso na pausa por > 60s → aparece "Forçar saída" como escape.

### Fora de escopo

- Fix de áudio one-way no MicroSIP (problema externo no headset/NAT do PC).
- Refatorar `TelefoniaAtendimentoWrapper` para ser componente próprio em arquivo separado.
- Repensar fluxo de TPA (`isACW`) — está funcionando, não mexer.

