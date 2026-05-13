## Diagnóstico — Andréia Simão (CPF 044.744.989-33), Y.BRASIL

**Acordo:** `cb8efd07…` — Entrada R$ 111,61 (06/04) + 3 parcelas R$ 111,61 (06/05, 06/06, 06/07).

**Estado real no banco:**
- `manual_payments`: 1 baixa confirmada da **entrada** (06/04).
- `negociarie_cobrancas`: 3 boletos com `installment_key` **legado** (gerados em 16/04 antes da padronização canônica):
  - `…:2` → vencimento 06/05 — **status `pago`**
  - `…:3` → vencimento 06/06 — `registrado`
  - `…:4` → vencimento 06/07 — `registrado`

**O que a UI está fazendo (bug):**
`AgreementInstallments.tsx` agora monta a parcela 1 com `customKey="1"`, parcela 2 com `customKey="2"`, parcela 3 com `customKey="3"` (chaves canônicas, sem offset da entrada). O lookup tenta primeiro `agreementId:customKey` (canônico) e cai em `agreementId:displayNumber` (legado) só quando não encontra:

```
parcela 1 (customKey "1"): expectedKey :1 não existe → fallback :2 → acha cobrança PAGA ✓
parcela 2 (customKey "2"): expectedKey :2 EXISTE (a mesma cobrança da parcela 1!) → marca como PAGA ❌
parcela 3 (customKey "3"): expectedKey :3 EXISTE (cobrança da parcela 2 legada, "registrado") → não marca paga
```

A mesma `negociarie_cobrancas` (`347c39c2…`, `:2`) é reivindicada por **duas** parcelas diferentes, então 06/06 herda o "pago" do 06/05.

A regra existe ("RIVO_FIX v2" para `manual_payments` evita exatamente esse vazamento) mas **não foi aplicada às cobranças Negociarie**.

---

## Plano de correção

### 1. Anti-vazamento no lookup de cobranças (frontend)
Em `src/components/client-detail/AgreementInstallments.tsx`:
- Manter um `Set<string> usedCobrancaIds` durante a montagem das parcelas.
- Para cada parcela, escolher cobrança seguindo esta prioridade:
  1. `installment_key === expectedKey` (canônico) **e** ainda não usado **e** com `data_vencimento` igual à `dueDate` da parcela.
  2. `installment_key === expectedKey` ainda não usado.
  3. `installment_key === legacyKey` ainda não usado.
- Ao escolher, registrar o id no `Set`. Isso impede que duas parcelas reclamem o mesmo boleto.

### 2. Mesmo anti-vazamento em `agreementInstallmentClassifier.ts`
A função `classifyInstallment` usa só `${agId}:${installment.key}` (sem fallback legado nem proteção). Aplicar a mesma estratégia (preferir match por `data_vencimento`, marcar consumido) — usado por `AcordosPage`, métricas e contagem de pagas/total. Hoje, para acordos legados, ela classifica como "vencido" parcelas pagas; para acordos novos, pode marcar errado igual à UI.

### 3. Backfill canônico das `negociarie_cobrancas` legadas
Migration que, para cada acordo com entrada, recalcula `installment_key`:
- Casos com entrada única: subtrair 1 do índice numérico (`:2`→`:1`, `:3`→`:2`, `:4`→`:3`); `:1` vira `:entrada` quando aplicável.
- Generalizado: usar `agreement.entrada_value > 0` + contagem de chaves `entrada*` para definir o offset.
- Rodar como `UPDATE` idempotente, escrevendo só onde o novo valor difere e a chave alvo ainda não existe (evita conflito com a unique implícita por acordo+chave).
- Logar quantos registros foram migrados em `audit_logs` (categoria `data_fix`).

### 4. Validação no caso reportado
Após (1)+(2)+(3): recarregar o acordo da Andréia Simão e confirmar:
- Entrada (06/04): pago ✓
- Parcela 1 (06/05): pago ✓
- Parcela 2 (06/06): **pendente / vigente** ✓
- Parcela 3 (06/07): vigente ✓
- Progresso: 2/4 (50%), não 3/4.

### Detalhes técnicos
- Nenhuma alteração em RLS, edge functions de geração ou contratos. O gerador atual (`generate-agreement-boletos`) já grava chaves canônicas; o problema é só com dados legados + lookup ingênuo.
- `manualPayments` continua inalterado (já é robusto via `RIVO_FIX v2`).
- A correção é determinística: prioriza match por data, depois canônico, depois legado, sempre evitando reuso.

### Memória a atualizar
Adicionar em `mem://logic/agreements/...` regra: "Lookup de `negociarie_cobrancas` por parcela deve evitar reuso da mesma cobrança e priorizar `data_vencimento` quando há ambiguidade entre chave canônica e legada."