## Resultado do sync 12/03 → 13/03: NÃO funcionou

A tela mostrou "159 inseridos / 30 atualizados / 187 pagos / 1 cancelado", mas isso é o **relatório do que o sistema pretendia fazer** — o gravamento no banco **falhou** no meio do caminho.

### Evidência nos logs do `maxlist-import` (19:33:08 UTC)

```
ERROR Chunk upsert error: null value in column "id" of relation "clients" violates not-null constraint
```

O lote inteiro do chunk foi rejeitado pelo Postgres. Como consequência:

- Nenhum cliente teve `status_cobranca_id` alterado pela exceção `isPagoOverridingInadimplente` que adicionamos.
- O `auto-status-sync` não chegou a ser disparado (rodaria depois do upsert, e nada do `Scheduling auto-status-sync` aparece nos logs).
- Verifiquei no banco: **0 clientes** ficaram com status "Em dia" ou "Quitado" nas últimas 2h.
- Exemplo: CPF `11276624573` (TESS MODELS) — parcela 1 voltou como `pago` da MaxSystem, mas continua com `status_cobranca_id = Inadimplente`.

### Causa raiz

No `maxlist-import` (linhas 501–616), o array `toUpsert` mistura inserts e updates no mesmo `.upsert(..., { onConflict: "external_id,tenant_id" })`. Quando um insert sem `id` colide com uma linha existente que o lookup não localizou (external_id duplicado dentro do mesmo chunk, ou linha que apareceu via fallback mas sem `id` setado), o Postgres acaba recebendo `id = null` e rejeita o chunk inteiro — perdendo também os updates legítimos que estavam no mesmo lote.

Isso é independente da nossa mudança de plano anterior — é um bug latente de quando os dados retornam com colisões/duplicatas, e qualquer chunk afetado derruba todos os updates daquele bloco.

### Plano de correção

Mudanças cirúrgicas, **só no `maxlist-import`**, sem tocar em frontend nem em outras edges:

1. **Separar inserts e updates em dois caminhos distintos** (substituir o upsert misto):
   - **Inserts** (rec sem `existing`) → `.insert(...)` puro, sem `onConflict` (já filtramos duplicatas localmente).
   - **Updates** (rec com `existing.id`) → `.upsert(..., { onConflict: "id" })` ou `.update(...).eq('id', ...)` em batch por id.
   - Garantir que o objeto enviado **nunca** tem `id: null/undefined`.

2. **Hardening defensivo**:
   - Antes de empurrar para `toUpsert`, validar `existing.id` truthy. Se não tiver, contar como `errors` e logar `processingLogs.push("update sem id válido para CPF X parcela Y")`.
   - Deduplicar `toInsert` por `external_id+tenant_id` dentro do chunk antes de gravar (evita colisão intra-batch).

3. **Logar resultado real, não pretendido**:
   - `inserted` / `updated` / `paid` no relatório só são incrementados **depois** do `.insert`/`.update` retornar sem erro. Hoje eles são contados antes, o que explica o relatório "verde" mesmo com chunk falhando.

4. **Re-rodar o sync 12/03 → 13/03 após o fix** para validar:
   - Logs do `maxlist-import` sem `Chunk upsert error`.
   - Aparece `Scheduling auto-status-sync (background)`.
   - Pelo menos um CPF que estava `Inadimplente` e veio como `pago` agora aparece como `Em dia`/`Quitado` ou `Acordo Vigente` (rollup correto pelo `auto-status-sync`).

### O que NÃO muda

- Lógica de hierarquia (`auto-status-sync`).
- Regra `isPagoOverridingInadimplente` (continua válida — só não rodou porque o chunk caiu).
- Nada de backfill: só vale daqui pra frente.
- Nenhuma alteração de schema, RLS, ou em `clients`/`agreements`.

### Arquivos afetados

- `supabase/functions/maxlist-import/index.ts` — separar insert/update e contar somente após sucesso.