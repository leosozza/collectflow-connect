## Validação da análise (verificação no banco)

Confirmei tudo que o Antigravity afirma, com nuances importantes. Resumo factual antes do plano de correção.

### ✅ O que está correto na análise

1. **Não existe UNIQUE em `manual_payments(agreement_id, installment_key)` nem em `negociarie_cobrancas(agreement_id, installment_key)`.** Verificado em `pg_index`: só existem índices NÃO-únicos (`idx_manual_pay_tenant_agr_key`, `idx_neg_cob_tenant_agr_key`, `idx_manual_payments_agreement_key`). O ÚNICO `UNIQUE (agreement_id, installment_key)` criado foi em `agreement_installments` (a tabela nova da SSOT). Então a "trava de idempotência da raiz" realmente ficou de fora.
2. **`tenant_id NOT NULL` + índices compostos por tenant aplicados** em `clients`, `agreements`, `manual_payments`, `negociarie_cobrancas`. Confirmado (vi `idx_clients_tenant_cpfnorm_credor`, `idx_agreements_tenant_cpfnorm_credor`, etc.).
3. **SSOT (`agreement_installments`) + Shadow Check + cron** estão criados e ativos. Confirmado.

### ⚠️ Onde o risco é menor do que o texto sugere (mas ainda real)

- **Duplicatas atuais**: rodei a checagem agora — `manual_payments` tem **0** pares duplicados de (agreement_id, installment_key) com status confirmado/approved; `negociarie_cobrancas` tem **1** par duplicado. Ou seja, hoje o estrago é mínimo, mas a porta está aberta.
- **Clique-duplo na UI duplicando pagamento**: o `rebuild_agreement_installments` agrega manual_payments com `SUM(amount_paid)` e `MAX(payment_date)` por `(agreement_id, installment_key)`. **Se o usuário clicar duas vezes em "Confirmar Pagamento" no mesmo segundo, vão entrar 2 linhas em `manual_payments` e a SSOT vai somar os dois valores** — então o risco de "parcela paga em dobro" no agregado é real, exatamente como o Antigravity descreve. Não é loop infinito, mas infla `paid_amount` e pode marcar como pago algo que era parcial.
- **Negociarie**: o lookup tem proteção `usedCobrancaIds` por parcela, então mesmo com 2 cobranças idênticas, só uma é "consumida" por parcela. A duplicata existente provavelmente está sendo ignorada pela rotina anti-leak, mas continua poluindo a fonte e o Shadow Check.

### ❌ Onde discordo da análise

- **"Atropelou as fases"**: a Fase 5 (SSOT como verdade única) já estava combinada e foi entregue na rodada anterior. O Antigravity está olhando só os arquivos novos e concluindo que ele pulou etapa, mas a SSOT não foi criada agora — foi criada nas rodadas de migração anteriores que você aprovou (`20260513151251_*` e antes). O que faltou de fato foi a **trava UNIQUE nas tabelas de origem**, que é diferente.
- **"Pode receber duas parcelas idênticas em `agreement_installments`"**: não. A própria `agreement_installments` tem UNIQUE `(agreement_id, installment_key)` e o `rebuild` faz `DELETE` + `INSERT` por acordo. O risco real está **no agregado de valor pago** (somar duplicado), não em criar 2 linhas iguais na SSOT.

### 📋 Plano (mínimo necessário, sem mexer em recebimento)

**Parte 1 — Limpar a única duplicata existente em `negociarie_cobrancas`**
- Identificar o par duplicado, manter o registro mais antigo (ou o que está vinculado ao `paid_source_id` da SSOT, se houver), apagar o restante.
- Sem isso o UNIQUE da Parte 2 não vai conseguir ser criado.

**Parte 2 — Criar as travas UNIQUE que faltaram (a trava de raiz da Fase 1)**
- `manual_payments`: UNIQUE parcial `(agreement_id, installment_key) WHERE installment_key IS NOT NULL AND status IN ('confirmed','approved','pending_confirmation')`. Parcial para não quebrar registros legados sem `installment_key` e para não bloquear `cancelled/rejected`.
- `negociarie_cobrancas`: UNIQUE parcial `(agreement_id, installment_key) WHERE installment_key IS NOT NULL`. Igualmente parcial para preservar histórico legado.
- Ambos via `CREATE UNIQUE INDEX CONCURRENTLY` se possível, ou normal dentro de migration.

**Parte 3 — Proteção UI/serviço contra clique-duplo (defesa em profundidade)**
- Em `manualPaymentService.ts`: antes do INSERT, fazer `SELECT 1 FROM manual_payments WHERE agreement_id=? AND installment_key=? AND status IN ('confirmed','approved','pending_confirmation') LIMIT 1`. Se existir, retornar erro amigável "Esta parcela já tem pagamento registrado".
- O UNIQUE da Parte 2 cobre o pior caso a nível de banco; este check evita o usuário ver erro genérico.

**Parte 4 — Não fazer nada na lógica de SSOT, triggers, recebimento, edge functions financeiras.** Tudo isso foi auditado nas rodadas anteriores e está convergente (0 drift, 0 órfãs, cron estável).

### O que NÃO mexer

- ❌ `agreement_installments`, `rebuild_agreement_installments`, triggers de recompute
- ❌ Edge functions de Negociarie / pagamento / portal
- ❌ Lógica de status hierárquico, carteira, dashboard
- ❌ Shadow check / cron

### Resumo em uma frase

A análise do Antigravity está **factualmente certa no ponto que importa** (faltou UNIQUE nas tabelas de origem), **exagera no diagnóstico de "atropelou fases"** (a SSOT foi aprovada antes) e o risco prático hoje é só **1 duplicata** em `negociarie_cobrancas` + **porta aberta** para clique-duplo em `manual_payments`. O plano acima fecha essa porta sem encostar em nada que envolva recebimento.

Posso executar?
