

## Plano de teste: validar ícone de telefone (CallButton) antes de produção

Vou validar a feature em 3 frentes — código (revisão estática), edge function (sanidade do `threecplus-proxy`) e fluxo no preview (browser automation com seu login atual).

### 1) Revisão de código (read-only)

Reler os 5 arquivos da entrega procurando regressões:
- `src/services/callService.ts` — validar tratamento de `agentStatus` (idle/paused vs on_call/acw), persistência de `pendingCall` em sessionStorage, expiração 2min, normalização do telefone (E.164 13 dígitos).
- `src/components/shared/CallButton.tsx` — confirmar `e.stopPropagation()` (não dispara navegação ao clicar dentro de linha clicável da Carteira), tooltip dinâmico, estado disabled quando `inCall`.
- `src/hooks/useAtendimentoModal.tsx` — verificar dispatcher do `pendingCall`: idempotência (`lastDispatchedRef`), match de `tenantId`, condição de idle correta.
- `src/components/atendimento/ClientHeader.tsx` e `src/components/client-detail/PhoneList.tsx` — confirmar que ícone aparece para todos os slots e respeita ausência de número.

### 2) Sanidade da edge function

`supabase--curl_edge_functions` em `threecplus-proxy` com action `click2call` usando um `agent_id` de teste e telefone fictício, só para confirmar que o endpoint responde com erro tratado (não 500 cru) — valida a malha de erro que o `CallButton` consome.

### 3) Validação funcional no preview (browser)

Você está em `/auth`. Após login, vou rodar **apenas leitura/observação** (sem disparar chamadas reais para não alarmar o cliente):

| Cenário | Como valido | Resultado esperado |
|---|---|---|
| Ícone aparece em ClientHeader | `navigate` em `/atendimento/:id` ou `/carteira/:id` de um cliente com telefone; `observe` botão verde ao lado do número | Botão `Phone` visível, verde, com tooltip "Ligar para (XX) XXXXX-XXXX" |
| Ícone aparece em PhoneList | `observe` painel lateral de telefones | Um botão por slot (Hot/2/3) preenchido |
| Cliente sem telefone | `navigate` para um cliente sem `phone` | Botão ausente OU disabled com tooltip "Sem telefone cadastrado" |
| Estado disabled quando ocupado | inspeção visual: se houver agente em `on_call`, ícone fica acinzentado com tooltip "Finalize a chamada atual…" | Confirmado por classe `opacity-40` + atributo `disabled` |
| Operador sem agent_id | leitura de `profile.threecplus_agent_id`; clique → toast de erro claro | Toast pedindo vínculo SIP, sem 500 |
| Sem credenciais 3CPlus no tenant | revisar lógica em `callService` | Toast claro, não dispara fetch ao proxy |
| Click2call real (opcional, só com sua autorização) | clicar 1 vez em telefone seu próprio para confirmar disparo end-to-end | Toast "Discando…", ramal SIP toca, `threecplus-proxy` retorna 200 |
| Fluxo desconectado → modal → auto-dial | desconectar 3CPlus, clicar ícone → redirect `/contact-center/telefonia`; após reconectar, dispatcher dispara automático em <2min | `pendingCall` no sessionStorage, dispatcher consome 1x (idempotente), toast "Conectado! Discando…" |

### Critérios de aprovação para produção

- [ ] Todos os botões renderizam corretamente nos 2 componentes integrados.
- [ ] Edge function responde com erro tratado (não 500 cru) para input inválido.
- [ ] Estados disabled (sem telefone, em chamada) funcionam.
- [ ] Toasts de erro são claros e acionáveis (sem agent_id, sem credenciais 3CPlus).
- [ ] Fluxo desconectado → conexão → auto-dial funciona com idempotência (não disca 2x).
- [ ] Pending call respeita expiração de 2min.
- [ ] Refactor do `AtendimentoPage.handleCall` mantém comportamento original (clicar "Ligar" no ClientHeader dentro de `/atendimento` segue idêntico).

### Itens que vou destacar como bloqueadores (se encontrados)

- Disparo duplicado do dispatcher (perde idempotência).
- Falha ao normalizar telefone (envio de número com máscara para o proxy).
- Toast genérico em vez do erro específico do proxy (ex.: "ramal SIP não registrado").
- Botão acionável durante `on_call` (risco de derrubar chamada).
- `pendingCall` não expira (risco de discagem inesperada minutos depois).

### Pré-requisitos para eu iniciar

1. **Faça login no preview** (você está em `/auth`). Sem login não consigo navegar para `/atendimento` nem `/carteira`.
2. **Confirme se posso disparar 1 chamada real** para um número seu, ou se prefere apenas validação visual + sanidade do endpoint.

Após sua confirmação, executo as 3 frentes e devolvo um relatório com **GO / NO-GO para produção** + lista de bugs (se houver).

