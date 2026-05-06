## Objetivo

Reduzir a lentidão na **atualização de parcelas** do MaxList sem alterar comportamento funcional, sem mexer em regras de negócio, e sem quebrar o que já entregamos hoje (remoção do "Outro", correção dos 80/50, etc.).

## Princípios de Segurança (o que NÃO será tocado)

- **Regras de status, derivação de status (`derivedStatus`), `PROTECTED_FIELDS`, `SYNC_FIELDS`** — mantidas idênticas.
- **Lógica de fallback por CPF + contrato + parcela** (`buildInstallmentMatchKey`, `ambiguousFallbackKeys`) — mantida idêntica.
- **`tipo_divida_id` protegido**, prioridade de cheque devolvido, e mapeamento `paymentTypeToDividaMap` — mantidos idênticos.
- **Consolidação de `client_profiles`** — mantida idêntica.
- **`auto-status-sync`** — continua executando ao final quando `status_cobranca_id === "__auto__"`.
- **Frontend**: nenhuma quebra nas telas atuais. `MaxListPage.tsx` continua chamando `maxlist-import` da mesma forma; novos parâmetros são **opcionais e retrocompatíveis**.
- **Contrato de resposta** (`report` com `inserted`, `updated`, `updated_records`, etc.) — mantido idêntico para não quebrar `ImportResultDialog`.
- **Banco de dados**: nenhuma migração, nenhum índice novo nesta fase (evita risco em produção).

## Otimizações (apenas o que é seguro)

### 1. Aumentar tamanho do chunk de reconciliação (200 → 500)

**Arquivo**: `supabase/functions/maxlist-import/index.ts`, linha 450
- `CHUNK_SIZE = 200` → `CHUNK_SIZE = 500`
- **Por que é seguro**: o `.in("external_id", externalIds)` aceita 500 valores tranquilamente; o upsert também. Reduz round-trips pela metade.

### 2. Paralelizar as duas SELECTs por chunk (existing + fallback)

Atualmente, dentro de cada chunk faz-se:
1. SELECT por `external_id`
2. SELECT por `cpf` (fallback) — só depois

A consulta de fallback **não depende** da primeira além de saber quais CPFs olhar. Manter a ordem atual mas envolver o fallback num `Promise.all` quando possível **não traz ganho** porque depende do resultado anterior. **Decisão: NÃO paralelizar** — manter ordem atual para preservar a lógica de "missingRecords".

### 3. Mover `auto-status-sync` para background com `EdgeRuntime.waitUntil`

**Arquivo**: `supabase/functions/maxlist-import/index.ts`, linhas 738-753
- Envolver o `fetch` em `EdgeRuntime.waitUntil(...)` para que a resposta retorne imediatamente, sem esperar o sync completar.
- **Por que é seguro**: o sync já é fire-and-forget (sem await do resultado real); apenas evita bloquear a resposta HTTP. Continua executando.

### 4. Consolidar `client_update_logs` em uma única inserção por chunk

**Arquivo**: `supabase/functions/maxlist-import/index.ts`, linhas 640-649
- Atualmente já faz batch de 200, mas dentro de cada chunk de 200 raramente passa disso. Trocar o sub-loop por uma única `insert(updateLogs)` quando `updateLogs.length <= 1000`.
- **Por que é seguro**: mantém exatamente os mesmos registros, só elimina o overhead de loop quando desnecessário.

### 5. Mensagem de progresso mais realista no frontend

**Arquivo**: `src/pages/MaxListPage.tsx`, linhas 874-876 e 954-956
- Manter o `setInterval` de progresso visual (não mexer na lógica), apenas adicionar texto informativo "Processando lotes no servidor — pode levar alguns minutos para grandes volumes" abaixo da barra.
- **Por que é seguro**: puramente visual.

## Otimizações DESCARTADAS (risco alto)

- ❌ **Passar `rawItems` do frontend** com `skip_fetch: true`: já existe no backend, mas exige mudança no frontend para serializar até ~50.000 registros num POST — risco de payload gigante, timeout do gateway, e mudanças no contrato. **Não fazer agora.**
- ❌ **Aumentar chunk para 1000**: pode estourar limites do PostgREST em alguns cenários de upsert. 500 é o sweet spot conservador.
- ❌ **Paralelizar chunks via `Promise.all`**: aumenta risco de deadlocks em upsert concorrente na mesma tabela `clients`. **Não fazer.**
- ❌ **Remover logs**: necessários para auditoria.

## Validação pós-mudança

1. Rodar uma atualização pequena (até 500 registros) e conferir:
   - `inserted`, `updated`, `unchanged` consistentes com execução anterior.
   - `updated_records` retornado igual ao formato atual.
   - `ImportResultDialog` abre normalmente.
2. Rodar uma atualização maior (5.000+ registros) e medir `duration_ms` — esperado ~30-40% menor.
3. Conferir que `auto-status-sync` é disparado (logs do Edge Function).
4. Conferir que `client_update_logs` ainda recebe os registros de mudança.

## Resumo

Apenas **4 mudanças cirúrgicas** (chunk size, waitUntil, log batch consolidado, texto de UI) que reduzem latência sem alterar nenhuma regra de negócio nem contrato com o frontend. Tudo o que entregamos hoje (Outro removido, correção 80/50) continua funcional.