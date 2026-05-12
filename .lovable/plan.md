
## Diagnóstico

**Conexão Negociarie está saudável.** O log da edge function `negociarie-callback` mostra callbacks chegando e sendo processados (último: acordo `56ce3b0c…` marcado como `completed` há minutos). REST e webhook respondendo 200.

**O caso da Eunice Coelho de Oliveira Rocha (CPF 570.887.051-68)** revelou um bug estrutural, não uma falha de conexão:

- Acordo `c23d48b3-…` tem **2 cobranças negociarie para a entrada**:
  - `installment_key = "<id>:entrada"` → status `registrado` (aberto)
  - `installment_key = "<id>:0"` → status `pago` em 11/05 (R$ 735,36)
- O callback marcou a chave `:0` como paga, mas o RIVO procura `:entrada` no classificador de parcelas → continua exibindo como vencida e o acordo nunca avança para `completed`.

### Causa raiz

Existem **dois geradores de boleto Negociarie com convenções de chave diferentes**:

| Caminho | Linha | Convenção |
|---|---|---|
| `src/services/negociarieService.ts` | 240 | `${agId}:${number}` → entrada = `:0` |
| `supabase/functions/generate-agreement-boletos/index.ts` | 344 | `${agId}:${inst.key}` → entrada = `:entrada` (canônico) |

O classificador (`src/lib/agreementInstallmentClassifier.ts:147`) e a UI (`AgreementInstallments.tsx`) usam a chave canônica (`entrada`, `entrada_2`, `1`, `2`…). Quando a entrada é gerada pelos dois caminhos (cenário comum quando o operador recobra/regenera), ficam duas linhas; o callback bate apenas em uma e a outra trava o acordo.

### Impacto verificado

- **17 acordos com pagamento da entrada confirmado pela Negociarie, mas travados em `pending`** (Eunice + 16 outras clientes — Janine Pinho Morais, Maraíza da Silva Nunes, Patrícia Santos Neves, Melissa Giovana, Leudiane Silva Araújo, Paloma Ramos, Bruna Ohara, Valdenice, Jullian, Edilma, Aline Matias, Elineuza, Nádia, Maíara, Vitória de Lima, e a Ana Patrícia que já está completed mas com a duplicata aberta).
- **44 acordos com a duplicação `:entrada` + `:0` no total** (os 27 restantes ainda não tiveram pagamento — vão cair no mesmo problema quando pagarem).

## Plano de correção

### 1. Padronizar geração de chaves (eliminar a causa)

Em `src/services/negociarieService.ts`:
- Substituir `buildInstallmentKey(agreementId, number)` para receber a `key` canônica (`"entrada"`, `"entrada_2"`, `"1"`, `"2"`…) em vez de `number`.
- Em `generateAgreementBoletos` e `generateSingleBoleto`, passar `inst.key` (já existente em `BoletoInstallment` via classificador) — para entrada usar `"entrada"`, para parcelas usar `String(inst.number)`.
- Manter `id_parcela` enviado à Negociarie inalterado (é apenas identificador externo).

Resultado: novos boletos da entrada serão sempre salvos com `installment_key = "<agId>:entrada"`, batendo com o edge function e com o classificador.

### 2. Reconciliação dos 17 acordos travados (migration única)

SQL idempotente que, para cada acordo onde existe par `:0 pago` + `:entrada não-pago`:

- Marca a cobrança órfã `:entrada` (status ≠ `pago`) como `status = 'substituido'`, copiando `valor_pago`, `data_pagamento` e `callback_data` da `:0` para preservar histórico.
- Recalcula o status do acordo via mesma lógica do callback (`paid_total >= proposed_total - 0.01` ⇒ `completed`).
- Insere registro em `audit_logs` (`action='reconcile_negociarie_duplicate_entrada'`).

### 3. Tratar os 27 acordos com duplicação ainda sem pagamento

Mesma migration: para cada acordo com `:entrada` (pendente) e `:0` (pendente, mesma `data_vencimento` e mesmo `valor`), marcar a `:0` como `substituido` (mantém a `:entrada` canônica como ativa). Quando o callback chegar, vai bater na chave certa.

### 4. Validação visual

- Abrir a tela do acordo da Eunice (CPF 570.887.051-68) e confirmar que a entrada aparece como **paga** e o acordo como **completed**.
- Conferir 2-3 acordos da lista (Janine, Bruna, Paloma) na tela de Acordos.

## Fora de escopo

- Reescrita do edge function `generate-agreement-boletos` (já está correto).
- Mudanças no fluxo de callback Negociarie (funcionando — logs OK).
- Alteração da UI de exibição de parcelas.
- Migração das chaves históricas das parcelas regulares (`:1`, `:2`…) — já são consistentes nos dois geradores.

## Risco

Baixo. A migration toca apenas linhas duplicadas identificadas por critério estrito (mesmo `agreement_id`, par `:entrada`/`:0`, mesmo valor/vencimento). A mudança no `negociarieService.ts` é compatível com cobranças antigas porque o classificador já testa pela chave canônica.
