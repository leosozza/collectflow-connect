

# Revisao Tecnica Completa: Integracao RIVO ↔ 3CPlus

## Diagnostico

Apos analise detalhada de todos os arquivos envolvidos, identifiquei os seguintes problemas organizados por area:

### CORRECAO 1 — Fonte de verdade duplicada para tabulacoes

**Problema**: Existem DUAS fontes de verdade concorrentes:
- `call_disposition_types` (tabela DB) — usada pelo `CallDispositionTypesTab`, `DispositionPanel`, `ThreeCPlusTab` (mapeamento)
- `tenant.settings.custom_disposition_types` (JSON no settings) — usada por `getDispositionTypes()` e `getCustomDispositionList()` no `dispositionService.ts` (linhas 263-277)
- `DISPOSITION_TYPES` (hardcoded, linhas 16-22) — fallback quando nenhuma das anteriores existe

O `DispositionPanel` pode estar lendo de `getCustomDispositionList(settings)` que retorna `custom_disposition_types` do settings em vez da tabela DB. Isso gera divergencia: o mapeamento mostra tabulacoes do DB mas o atendimento pode mostrar tabulacoes do settings.

**Correcao**:
- Eliminar `getDispositionTypes()` e `getCustomDispositionList()` — substituir por `fetchTenantDispositionTypes()` em todos os pontos de consumo
- Remover dependencia de `custom_disposition_types` do settings
- Manter `DISPOSITION_TYPES` apenas como fallback de seed

### CORRECAO 2 — Sync desacoplado (CRUD local nao garante sync remoto)

**Problema**: O `CallDispositionTypesTab` ja chama `syncDispositionsTo3CPlus()` apos create/update/delete, mas:
- O sync e fire-and-forget (`.catch(() => {})` — linhas 210, 222, 232) — falhas sao silenciosas
- O usuario nao tem feedback se o sync falhou
- Nao ha retry automatico
- Deletar uma tabulacao local remove da tabela DB, mas o sync so remove da 3CPlus por nome (matching por `activeLabels` — proxy linha 1093-1101), o que pode falhar se o nome mudou

**Correcao**:
- Tornar o sync pos-CRUD awaitable com feedback (toast de sucesso/erro especifico para sync)
- Na delecao, usar `threecplus_qualification_id` para deletar por ID na 3CPlus em vez de por nome
- Adicionar badge de status de sync por tabulacao (sincronizado/pendente)

### CORRECAO 3 — Mapeamento de qualification_id fragil

**Problema**:
- `qualifyOn3CPlus()` usa `threecplus_disposition_map` do settings como mapa `key → qualification_id`
- O mapeamento manual (ThreeCPlusTab) e o mapeamento automatico (syncDispositionsTo3CPlus) escrevem no mesmo campo `threecplus_disposition_map`
- Se o usuario faz sync automatico e depois edita manualmente, um sobrescreve o outro
- A coluna `threecplus_qualification_id` na tabela `call_disposition_types` e preenchida pelo sync mas NUNCA e usada pelo `qualifyOn3CPlus()` — e ignorada, preferindo o settings JSON

**Correcao**:
- `qualifyOn3CPlus()` deve priorizar `threecplus_qualification_id` da tabela DB (lookup por key na `call_disposition_types`) em vez do settings JSON
- O settings `threecplus_disposition_map` passa a ser backup/cache, nao fonte primaria
- Unificar: o mapeamento manual no ThreeCPlusTab tambem deve persistir o `threecplus_qualification_id` na tabela DB alem do settings

### CORRECAO 4 — Webhook faz lookup por label (texto), nao por ID

**Problema**: `threecplus-webhook/index.ts` linhas 227-233:
```typescript
.ilike("label", qualification)  // match por TEXTO!
```
Se o nome da tabulacao no RIVO difere minimamente do nome na 3CPlus (acento, espaco, maiuscula), o match falha silenciosamente.

**Correcao**:
- Priorizar lookup por `threecplus_qualification_id` (match `qualificationId` do payload contra a coluna `threecplus_qualification_id` da tabela)
- Usar `ilike("label", ...)` apenas como fallback secundario

### CORRECAO 5 — Lista "RIVO Tabulacoes" pode misturar contextos

**Problema**: O sync cria UMA lista chamada "RIVO Tabulacoes" global na conta 3CPlus e vincula a TODAS as campanhas. Se dois tenants compartilham a mesma conta 3CPlus, as tabulacoes se misturam.

**Correcao**:
- Nomear a lista com o tenant: `"RIVO - {tenant_name}"` para isolamento
- Verificar se o tenant ja tem `threecplus_qualification_list_id` salvo e usar esse ID diretamente em vez de buscar por nome

### CORRECAO 6 — Intervalos de pausa: fluxo ja funcional, mas verificar robustez

**Problema menor**: O `loadPauseIntervals` usa `agent_work_break_intervals` como primario (correto), com fallback para `campaign_details → list_work_break_group_intervals`. Funciona, mas:
- Se o agente nao esta logado em campanha, `agent_work_break_intervals` pode retornar vazio
- O fallback precisa de `campaign_id` que pode nao estar disponivel

**Correcao**: Adicionar log mais claro quando intervalos estao vazios e exibir mensagem na UI explicando que a campanha pode nao ter grupo de intervalos vinculado.

### CORRECAO 7 — Proxy mascara erros como HTTP 200

**Problema**: O proxy SEMPRE retorna HTTP 200 (linhas 1181-1189), incluindo `success: boolean` no body. Porem:
- Erros de agent nao encontrado retornam HTTP 200 com `status: 404` no body (linhas 694-697, 711-714, etc.)
- O frontend em varios pontos nao checa `data.success === false`
- O `invoke()` do TelefoniaDashboard (linha 347-353) nao verifica `success`

**Correcao**:
- Padronizar o `invoke()` do TelefoniaDashboard para checar `data.success === false` e lancar erro (mesmo padrao ja aplicado no WorkBreakIntervalsPanel)
- Manter o proxy retornando 200 (necessario para evitar que o Supabase SDK lance erro), mas garantir que TODOS os consumidores verifiquem o campo `success`

### CORRECAO 8 — Fluxo do atendimento: disposition local antes de qualify remoto

**Problema**: Em `AtendimentoPage.tsx`, o `dispositionMutation.onSuccess` (linhas 135-168):
1. Salva a disposition local
2. Executa automacoes
3. Salva call_log
4. Chama `qualifyOn3CPlus()` — mas de forma fire-and-forget (.then/.catch)

Se o qualify falha, a disposition local ja foi salva. O usuario ve "Tabulacao salva" mas a 3CPlus fica dessincronizada.

**Correcao**:
- Manter a ordem atual (local primeiro para nao perder dados), mas mostrar toast especifico quando o qualify falha: "Tabulacao salva no RIVO, mas falhou na 3CPlus — tente sincronizar manualmente"
- Registrar flag de "sync pendente" para a disposition

### CORRECAO 9 — Operacoes de agente: click2call com fallback perigoso

**Problema**: `click2call` (proxy linhas 812-849) usa `agent_id` como fallback de `extension` quando a extension nao e encontrada (linha 836-837). Isso pode causar comportamento incorreto pois `agent_id` nao e o mesmo que `extension` SIP.

**Correcao**: Em vez de usar agent_id como fallback, retornar erro claro: "Extension SIP nao encontrada para o agente. Configure a extension no 3CPlus."

### CORRECAO 10 — Isolamento por tenant

**Problema menor**: O proxy recebe `domain` e `api_token` do frontend em cada chamada. Cada tenant tem suas credenciais no settings. O isolamento depende do frontend enviar as credenciais corretas. Nao ha validacao no proxy de que o tenant autenticado corresponde ao domain/token enviados.

**Correcao**: No proxy, opcionalmente validar o tenant_id do usuario autenticado contra o domain/token, mas isso requer JWT validation que o proxy atualmente nao faz. Como correcao minima: logar o tenant_id junto com o domain em cada chamada para auditoria.

## Arquivos a editar

| Arquivo | Mudancas |
|---|---|
| `src/services/dispositionService.ts` | Eliminar `getDispositionTypes()`/`getCustomDispositionList()`, usar DB como fonte unica; `qualifyOn3CPlus()` buscar `threecplus_qualification_id` da tabela; melhorar feedback de sync |
| `src/components/atendimento/DispositionPanel.tsx` | Usar `fetchTenantDispositionTypes()` em vez de `getCustomDispositionList(settings)` |
| `src/pages/AtendimentoPage.tsx` | Toast especifico quando qualify na 3CPlus falha |
| `supabase/functions/threecplus-webhook/index.ts` | Priorizar lookup por `threecplus_qualification_id` em vez de label |
| `supabase/functions/threecplus-proxy/index.ts` | Nomear lista com tenant; click2call sem fallback perigoso; delecao por ID no sync |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Padronizar `invoke()` para checar `success`; mensagem clara quando intervalos vazios |
| `src/components/integracao/ThreeCPlusTab.tsx` | Mapeamento manual persiste `threecplus_qualification_id` na tabela DB |
| `src/components/cadastros/CallDispositionTypesTab.tsx` | Sync com feedback visivel (await + toast de erro especifico); badge de status de sync |

## Resultado esperado

- Uma unica fonte de verdade: tabela `call_disposition_types`
- CRUD local dispara sync confiavel com feedback
- `qualifyOn3CPlus` usa ID da tabela DB (nao settings JSON)
- Webhook mapeia por ID, nao por texto
- Erros da 3CPlus nunca sao mascarados
- Click2call nao usa fallback perigoso
- Lista de qualificacoes isolada por tenant
- Intervalos com mensagem clara quando vazios

