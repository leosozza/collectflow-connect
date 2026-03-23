

# Auditoria Técnica Completa — Integração RIVO × 3CPlus

---

## 1. O QUE ESTÁ FUNCIONANDO CORRETAMENTE

| Funcionalidade | Arquivo | Status |
|---|---|---|
| Login de agente em campanha | `threecplus-proxy` → `login_agent_to_campaign` | ✅ Funcional — resolve token do agente, chama `POST /agent/login` |
| Connect agent (SIP) | `threecplus-proxy` → `connect_agent` | ✅ Funcional |
| Logout agent | `threecplus-proxy` → `logout_agent_self` | ✅ Funcional |
| Pause agent (work_break/enter) | `threecplus-proxy` → `pause_agent` | ✅ Funcional — usa `POST /agent/work_break/{id}/enter` |
| Unpause agent (work_break/exit) | `threecplus-proxy` → `unpause_agent` | ✅ Funcional |
| List campaigns | `threecplus-proxy` → `list_campaigns` | ✅ Funcional |
| Campaign statistics | `threecplus-proxy` → `campaign_statistics` | ✅ Funcional |
| Agents status | `threecplus-proxy` → `agents_status` | ✅ Funcional |
| Company calls | `threecplus-proxy` → `company_calls` | ✅ Funcional |
| Click2call | `threecplus-proxy` → `click2call` | ✅ Funcional — resolve extension do agente |
| Hangup call | `threecplus-proxy` → `hangup_call` | ✅ Funcional |
| Qualify call | `threecplus-proxy` → `qualify_call` | ✅ Funcional — usa `POST /agent/call/{id}/qualify` |
| Sync dispositions | `threecplus-proxy` → `sync_dispositions` | ✅ Funcional — cria/atualiza lista "RIVO Tabulações" na 3CPlus |
| Campaign qualifications | `threecplus-proxy` → `campaign_qualifications` | ✅ Funcional — `GET /campaigns/{id}/qualifications` |
| Work break groups | `threecplus-proxy` → `list_work_break_groups` / `list_work_break_group_intervals` | ✅ Funcional |
| Detecção de chamada ativa | `TelefoniaDashboard.tsx` → `activeCall` useMemo | ✅ Funcional — filtra do company_calls |
| Resolução de cliente por CPF/ID/telefone | `TelefoniaAtendimentoWrapper` | ✅ Funcional — busca escalonada |
| Detecção de status TPA (status 4) | `TelefoniaDashboard.tsx` | ✅ Funcional — mapeado como "TPA — Pós-atendimento" |
| Auto-sync de tabulações ao criar/editar/excluir | `CallDispositionTypesTab.tsx` | ✅ Funcional — chama `syncDispositionsTo3CPlus` após cada CRUD |
| Vínculo automático da lista de qualificações a campanhas | `dispositionService.ts` → `syncDispositionsTo3CPlus` | ✅ Funcional — loop PATCH em todas as campanhas |
| Webhook receptor | `threecplus-webhook/index.ts` | ✅ Funcional — resolve tenant por domínio, processa eventos |
| Isolamento por tenant (credenciais) | `threecplus-proxy` recebe `domain` + `api_token` do body | ✅ Correto — cada chamada usa credenciais do tenant |

---

## 2. O QUE ESTÁ PARCIALMENTE IMPLEMENTADO

### 2.1 — Mapeamento de tabulações (disposition_map)

**Onde está**: `tenants.settings.threecplus_disposition_map`

**Como funciona**: O `syncDispositionsTo3CPlus` cria um mapa `{ "cpc": 12345, "voicemail": 12346 }` onde a chave é o `key` da tabulação RIVO e o valor é o `id` da qualification na 3CPlus. Esse mapa é salvo no `settings` do tenant.

**O que funciona**: A sincronização em si cria/atualiza itens na lista "RIVO Tabulações" e gera o mapeamento.

**Problema 1 — Mapa pode ter 0 itens**: Na screenshot do console, mostra "0 tabulações mapeadas". Isso indica que o `sync_dispositions` está rodando mas o `resultMap` está vindo vazio. A causa provável é que a 3CPlus retorna a resposta de criação do item num formato que não contém `id` diretamente (ex: `{ data: { id: 123 } }` vs `{ id: 123 }`). No código (linha 1018): `if (newItem?.id) resultMap[disp.key] = newItem.id` — se a resposta da 3CPlus encapsula em `data`, o `newItem.id` é undefined.

- **Impacto**: Sem mapa, o `qualifyOn3CPlus` nunca encontra `qualificationId` (linha 330: `map[params.dispositionType]` retorna undefined) e aborta silenciosamente. Resultado: agente fica preso em TPA.
- **Causa**: Parsing da resposta de criação de qualificação na 3CPlus não considera formato `{ data: { id: N } }`.
- **Como corrigir**: Na linha 1017-1021 do proxy, fazer `const id = newItem?.id || newItem?.data?.id`. Logar a resposta completa.

**Problema 2 — Match por nome (`item.name === disp.label`)**: A sincronização usa o `label` da tabulação para encontrar itens existentes na 3CPlus. Se o operador renomear uma tabulação no RIVO, o sistema não encontra o item na 3CPlus e cria um duplicado em vez de atualizar.

- **Impacto**: IDs duplicados, mapeamento incorreto.
- **Causa**: Falta de vínculo persistente por ID (usa nome como chave de correspondência).
- **Como corrigir**: Salvar o `qualification_id` da 3CPlus na tabela `call_disposition_types` e usar como referência principal, caindo pro match por nome como fallback.

### 2.2 — Qualificação automática ao tabular na ficha (qualifyOn3CPlus)

**Onde está**: `dispositionService.ts` linha 318-374

**O que funciona**: Chama `qualify_call` com o `callId` do sessionStorage e o `qualificationId` do mapa.

**Problema**: Se o `disposition_map` estiver vazio (problema 2.1), o qualify nunca acontece. O `callId` depende de `sessionStorage.getItem("3cp_last_call_id")`, que é populado pelo `company_calls` — mas esse ID pode ser no formato `call:7712:252005:4N5aR0Q4gk` (como vemos no console). A API 3CPlus espera um formato específico de call_id para o endpoint `/agent/call/{call_id}/qualify`. Se o formato estiver errado, a 3CPlus retorna erro e o agente fica preso.

- **Impacto**: Agente fica em TPA/pausa após tabular.
- **Causa**: Formato de call_id incompatível + disposition_map vazio.
- **Como corrigir**: Validar formato do call_id; usar o campo `telephony_id` do call data (ex: `4N5aR0Q4gk`) como call_id para a API de qualify.

### 2.3 — Intervalos de pausa para operadores

**Onde está**: `TelefoniaDashboard.tsx` → `loadPauseIntervals` (linha 604-637)

**O que funciona**: Busca `work_break_group_id` da campanha e carrega intervalos via `list_work_break_group_intervals`.

**Problema**: O `loadPauseIntervals` usa `[...campaigns, ...agentCampaigns]` como fonte. Porém, quando a função é chamada via `useEffect` (linha 733), os arrays `campaigns` e `agentCampaigns` podem ainda estar vazios (state não populado). O `useCallback` tem dependência em `[invoke, campaigns, agentCampaigns]`, mas na primeira execução os arrays estão `[]`. Resultado: não encontra a campanha, vai para o fallback `campaign_details`, e pode não encontrar `work_break_group_id` dependendo do formato da resposta.

- **Impacto**: Intervalos não aparecem na tela de atendimento (confirmado pelo usuário).
- **Causa**: Race condition — `loadPauseIntervals` é chamado antes de `campaigns`/`agentCampaigns` serem populados pelo `fetchAll`.
- **Como corrigir**: Chamar `loadPauseIntervals` APÓS `fetchAll` completar (ou usar diretamente `campaign_details` sem depender do state).

---

## 3. O QUE ESTÁ QUEBRADO OU INCONSISTENTE

### 3.1 — Proxy retorna HTTP 200 mesmo quando 3CPlus falha

**Onde está**: `threecplus-proxy/index.ts` linha 1112-1120

**O que acontece**: O proxy SEMPRE retorna HTTP 200 ao frontend, incluindo o status real da 3CPlus no body (`{ ...data, status: response.status }`). O frontend verifica `result?.status && result.status >= 400`, mas isso depende de a 3CPlus retornar JSON com status — se retornar HTML ou texto vazio, o proxy converte para `{ status: 200, success: true }` (linhas 1095-1099), mascarando o erro.

Além disso, quando o agente não é encontrado em `resolveAgentToken`, o proxy retorna `status: 200` com body `{ status: 404, detail: "..." }` (linha 682). Isso é proposital para evitar erros CORS, mas cria um risco de falso positivo se o frontend não checar o `data.status`.

- **Impacto**: Operações podem parecer bem-sucedidas quando falharam.
- **Como corrigir**: Padronizar o campo `success: boolean` em todas as respostas do proxy.

### 3.2 — Webhook sem secret configurado

**Onde está**: Secrets list — `THREECPLUS_WEBHOOK_SECRET` **NÃO EXISTE** nos secrets configurados.

**O que acontece**: O webhook aceita qualquer requisição sem validação (linha 26: `if (webhookSecret && providedSecret !== webhookSecret)` — como `webhookSecret` é undefined, o check é pulado).

- **Impacto**: Risco de segurança — qualquer um pode enviar payloads falsos.
- **Como corrigir**: Adicionar o secret `THREECPLUS_WEBHOOK_SECRET` e configurar na 3CPlus.

### 3.3 — call_logs: coluna `external_id` vs `call_id_external`

**Onde está**: `threecplus-webhook/index.ts` usa `external_id`, mas `dispositionService.ts` → `saveCallLog` (linha 424) usa `call_id_external`.

- **Impacto**: Se as colunas forem diferentes, uma das inserções falha silenciosamente.
- **Como corrigir**: Verificar schema da tabela `call_logs` e padronizar.

### 3.4 — Webhook: profiles sem `threecplus_agent_id` para resolução de operador

**Onde está**: `threecplus-webhook/index.ts` linhas 237-248

**O que acontece**: O webhook tenta criar `call_dispositions` mas não consegue resolver o `operator_id` porque a query na `profiles` não filtra por `threecplus_agent_id`. O comentário no código diz "For now, we don't have a reliable mapping".

- **Impacto**: Disposições criadas via webhook ficam sem `operator_id`.
- **Como corrigir**: A coluna `threecplus_agent_id` já existe nos profiles — usar `await supabase.from("profiles").select("id").eq("threecplus_agent_id", agentId)`.

---

## 4. RISCOS OPERACIONAIS ATUAIS

| # | Risco | Severidade | Descrição |
|---|---|---|---|
| R1 | Agente fica preso em TPA | **Alta** | Se `disposition_map` estiver vazio ou `callId` em formato errado, o qualify falha silenciosamente e o agente não retorna ao idle |
| R2 | Intervalos invisíveis | **Média** | Race condition no carregamento de pausas — operador não vê opções de intervalo |
| R3 | Falso positivo de sucesso | **Média** | Proxy sempre retorna 200; erros da 3CPlus podem ser interpretados como sucesso |
| R4 | Tabulações duplicadas na 3CPlus | **Baixa** | Renomear tabulação no RIVO cria duplicado na lista de qualificações |
| R5 | Webhook sem autenticação | **Média** | Qualquer pessoa com a URL pode enviar eventos falsos |
| R6 | Isolamento por tenant no webhook | **Baixa** | Funciona por match de domínio, mas se dois tenants tiverem o mesmo domínio (improvável mas possível se configurado errado), haveria cruzamento |

---

## 5. CORREÇÕES EM ORDEM DE PRIORIDADE

### Prioridade 1 (Crítico — bloqueia operação)

**P1.1 — Corrigir parsing do `resultMap` na sync_dispositions**
- Arquivo: `supabase/functions/threecplus-proxy/index.ts` linha 1017-1021
- Problema: `newItem.id` pode estar em `newItem.data.id`
- Fix: `const id = newItem?.id || newItem?.data?.id`
- Impacto: Sem isso, o mapa de qualificações fica vazio e nenhuma qualificação automática funciona

**P1.2 — Corrigir formato do `callId` para qualify**
- Arquivo: `src/services/dispositionService.ts` e `TelefoniaDashboard.tsx`
- Problema: O `callId` salvo no sessionStorage pode ser `call:7712:252005:4N5aR0Q4gk` quando a 3CPlus espera `4N5aR0Q4gk` (telephony_id)
- Fix: Ao salvar no sessionStorage, usar `call.telephony_id || call.id`; no `company_calls` response, extrair o `telephony_id`
- Impacto: Sem isso, o qualify falha com 404/422 e o agente fica preso

**P1.3 — Corrigir race condition dos intervalos**
- Arquivo: `TelefoniaDashboard.tsx` → `loadPauseIntervals`
- Problema: Chamado antes de `campaigns`/`agentCampaigns` serem populados
- Fix: Usar `campaign_details` diretamente (sem depender do state) ou chamar `loadPauseIntervals` dentro do callback de `fetchAll`

### Prioridade 2 (Importante — melhora confiabilidade)

**P2.1 — Adicionar campo `threecplus_qualification_id` à tabela `call_disposition_types`**
- Fix: Migration + salvar ID da 3CPlus por tabulação, usar como referência principal no sync
- Impacto: Evita duplicados e garante correspondência 1:1

**P2.2 — Padronizar resposta do proxy com campo `success: boolean`**
- Fix: Adicionar `success: response.ok` em todas as respostas JSON do proxy
- Impacto: Frontend pode detectar erros de forma confiável

**P2.3 — Resolver operador no webhook via `threecplus_agent_id`**
- Fix: `supabase.from("profiles").select("id").eq("threecplus_agent_id", agentId).eq("tenant_id", tenantId)`

### Prioridade 3 (Melhoria — segurança e manutenção)

**P3.1 — Configurar secret `THREECPLUS_WEBHOOK_SECRET`**

**P3.2 — Padronizar coluna de call_id externo em `call_logs`** (verificar se é `external_id` ou `call_id_external`)

**P3.3 — Logar respostas completas do sync_dispositions** para debug de problemas de mapeamento

---

## RESPOSTAS DIRETAS

### O vínculo entre tabulação do RIVO e qualification da 3CPlus está confiável?
**NÃO.** O mapeamento depende do `disposition_map` salvo em `tenants.settings`, que está retornando vazio (0 tabulações mapeadas). A causa é o parsing da resposta de criação na 3CPlus (linha 1018 do proxy). Sem mapa válido, nenhuma qualificação automática funciona.

### A sincronização de tabulações é automática?
**SIM, é automática** — a cada CRUD de tabulação no RIVO, o `CallDispositionTypesTab` chama `syncDispositionsTo3CPlus`. Porém a sync está parcialmente quebrada (mapa vazio) e o vínculo às campanhas funciona mas sem itens no mapa.

### Por que os intervalos não aparecem na tela de atendimento?
**Race condition.** O `loadPauseIntervals` é chamado quando o agente está online, mas depende de `campaigns`/`agentCampaigns` que ainda estão vazios. O fallback via `campaign_details` funciona em alguns casos, mas depende de encontrar `work_break_group_id` na resposta — se a chave estiver aninhada em `dialer_settings`, pode não ser detectada.

