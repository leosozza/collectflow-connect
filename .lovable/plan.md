# Análise — Boleto da Cristiane abre 28/05 mas no sistema mostra 28/04

## O que foi diagnosticado

Acordo `f408e6a0...` (Cristiane da Penha Rocha):

- `first_due_date` = 2026-04-28
- `entrada_value` = 286,58 (paga em 02/04)
- `new_installments` = 11
- `custom_installment_dates` = `{ entrada: 2026-04-02, 2: 2026-04-28 }`

Cobranças no Negociarie (`negociarie_cobrancas`):

| installment_key | data_vencimento (DB / boleto) |
|---|---|
| `:1` | **28/04/2026** (paga) |
| `:2` | **28/05/2026** ← exibido como "Parcela 2/12" mas a UI mostra 28/04 |
| `:3` | 28/06/2026 |
| `:4` | 28/07/2026 |
| ... | ... |
| `:11` | 28/02/2027 |

A UI calcula a data de cada parcela com `addMonths(first_due_date, i)` para `i = 0..10` e usa `instNum = (hasEntrada ? 1 : 0) + i + 1`, ou seja:

- "Parcela 2/12" → `instNum = 2`, `dueDate = 28/04` (i=0)
- "Parcela 3/12" → `instNum = 3`, `dueDate = 28/05` (i=1)

Mas o boleto que foi efetivamente gerado no Negociarie e gravado com `installment_key :2` está com **28/05**. Quando o usuário clica no link do boleto da "Parcela 2/12", abre o PDF com vencimento 28/05.

## Causa raiz

A numeração `installment_key:N` usada pela UI hoje está **deslocada em 1** em relação à numeração que foi usada quando os boletos da Cristiane foram gerados (16/04). Há indício de que a fórmula `instNum = (hasEntrada ? 1 : 0) + i + 1` foi alterada depois da geração — antes a 1ª parcela após a entrada era `:1` (28/04), agora a UI a chama de `:2` enquanto a cobrança 28/04 continua salva como `:1` no banco.

Resultado: a UI procura `:2` (28/05) e mostra como se fosse a parcela de 28/04. O boleto aberto tem a data correta do que foi gerado (28/05), divergindo do que a UI mostra (28/04).

Conferi outros acordos: dezenas têm a mesma divergência entre `installment_key :1` e `first_due_date`. **Não é caso isolado.**

O fato da entrada ter sido paga em atraso é circunstancial — não influencia a lógica das parcelas.

## Plano de correção

### 1. Reconciliar numeração UI ↔ cobrança (canônico)

Adotar como verdade única: **`installment_key:N` representa a parcela com `displayNumber = N`**, onde `N=0` é entrada e `N=1` é a primeira parcela após a entrada (com `dueDate = first_due_date`). Isso é o que a maioria dos boletos antigos no banco já segue.

Em `src/components/client-detail/AgreementInstallments.tsx`:

- Trocar `const instNum = (hasEntrada ? 1 : 0) + i + 1;` (linha 186) por `const instNum = i + 1;`.
- Manter `displayNumber = instNum` para exibir "1/12, 2/12, ..." quando não há entrada e "Entrada, 1/N, 2/N, ..." quando há.
- Ajustar `customKey` para continuar usando `String(instNum)` (mesma chave que `custom_installment_dates` e `custom_installment_values`).
- O `expectedKey` para lookup de cobrança continua `${agreementId}:${instNum}`.

Como `custom_installment_dates` da Cristiane usa a chave `2` para 28/04 (refletindo a UI atual), também é necessário **migrar `custom_installment_dates` e `custom_installment_values`** dos acordos existentes para o novo esquema (chave N → N-1 quando há entrada).

### 2. Migração de dados (SQL)

Migration única que, para cada acordo com `entrada_value IS NOT NULL`:

- Decrementa em 1 as chaves numéricas em `custom_installment_dates` e `custom_installment_values` (chave `2` → `1`, `3` → `2`, etc.). Mantém intactas as chaves `entrada`, `entrada_*` e `entrada_method`.
- **Não toca em `negociarie_cobrancas`** — os `installment_key :N` já estão corretos sob o novo esquema (`:1` = primeira após entrada).

### 3. Detecção e reemissão dos boletos divergentes

Mesmo após a renumeração, o boleto `:2` da Cristiane continua errado (28/05 em vez de 28/04 — porque 28/04 ficou em `:1`, que está pago). Especificamente: a parcela "2/12" exibida pela UI passa a ser `installment_key:2` com `defaultDate = 28/05` — que **bate** com o boleto gerado. ✓

Ou seja: após a migração, a UI da Cristiane vai exibir corretamente "Parcela 2/12 — 28/05", "Parcela 3/12 — 28/06"... e cada link de boleto vai abrir um PDF com o vencimento idêntico. O comportamento do "cliente pagou em atraso" não muda nada — a entrada foi paga, e as 11 parcelas seguem o cronograma original (28/04, 28/05, ..., 28/02/2027).

Para acordos onde houve edição manual de data (`custom_installment_dates`) divergente do boleto já gerado, criar um utilitário (botão na UI) que detecte cobranças `pendente` cujo `data_vencimento` ≠ `dueDate` calculada e ofereça reemissão em massa via `negociarieService.generateSingleBoleto`. Escopo opcional para uma segunda iteração.

### 4. Componentes ajustados

- `src/components/client-detail/AgreementInstallments.tsx` — corrigir fórmula de `instNum`.
- `src/components/client-detail/AgreementCalculator.tsx` — verificar se também usa o esquema antigo ao gravar `custom_installment_dates/values` para novos acordos (se sim, alinhar).
- Migration SQL para reescrever `custom_installment_dates` e `custom_installment_values` dos acordos com entrada existentes.

### 5. Casos sem entrada

Sem `entrada_value`, a fórmula atual já produz `instNum = i + 1`, então nada muda.

## Arquivos afetados

- `src/components/client-detail/AgreementInstallments.tsx`
- `src/components/client-detail/AgreementCalculator.tsx` (verificação)
- Migration SQL (renumeração de chaves em `agreements.custom_installment_dates` e `custom_installment_values`)

## Validação após implantação

- Para Cristiane: parcela 2/12 deve mostrar 28/05 e abrir boleto com 28/05; parcela 3/12 → 28/06; etc.
- Reabrir uma amostra de 5 acordos com entrada e conferir que todas as datas exibidas batem com os boletos.
- Acordos sem entrada não devem mudar.

## Observação importante

Optei por **alinhar a UI ao banco** (que tem 11 boletos já registrados) em vez de **regerar os 11 boletos** para alinhar ao display atual. Motivos:
- 11 boletos × dezenas de acordos = custo alto e risco de duplicidade no Negociarie.
- O cronograma que está nos boletos é o cronograma comercial correto (entrada + 11 parcelas mensais consecutivas).
- A migração só renumera chaves em JSONB nos acordos; não toca em cobranças.
