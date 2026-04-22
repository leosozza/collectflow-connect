

## Plano: corrigir duplicatas remanescentes + auditoria do dashboard

### Diagnóstico

Após o cleanup anterior (44 duplicatas → `superseded`), restaram **4 acordos com duplicatas reais** que escaparam porque misturam `installment_key` `NULL` (legado) com a chave canônica (`"entrada"`, `"1"`, `"2"`). O guard de duplicidade atual (`findExistingActivePayment`) trata `NULL` e `"entrada"` como chaves diferentes, então ambas convivem. A migration anterior agrupou por `COALESCE(installment_key, installment_number::text)`, mas isso não unifica `NULL` da entrada com a string `"entrada"`.

**Duplicatas reais remanescentes** (R$ 865,42 inflados no total):

| Acordo | Cliente | Parcela | Baixas | Manter | Reverter |
|---|---|---|---|---|---|
| `715e16a3` | Natani | entrada | 118,64 (entrada) + 118,64 (NULL) | mais recente | 118,64 |
| `c888ddf6` | — | 1 | 466,00 (NULL) + 466,00 ("1") | mais recente ("1") | 466,00 |
| `e66340e7` | — | entrada | 136,36 (entrada) + 144,42 (NULL) | **144,42 (mais recente, valor correto)** | 136,36 |
| `e66340e7` | — | 2 | 136,36 ("2") + 136,36 (NULL) | mais recente | 136,36 |

**Falsos positivos** (NÃO mexer): `079bb3e1` (Raiane) e `c7493649` (Samantha) têm `entrada` + `entrada_2` como **duas parcelas legítimas** de multi-entrada — ambas baixas válidas.

### Estado do dashboard

- `manual_payments`: 193 confirmed, 44 superseded, 2 pending, 1 rejected.
- O dashboard soma `amount_paid` de TODOS confirmed → hoje está **R$ 865,42 inflado** em 4 acordos.
- 2 baixas pendentes aguardando admin (Maria de Fátima R$ 582,75 / Edivania R$ 153,25) — informativo, não é bug.
- Sync round 2 anterior pegou todos os divergentes → **0 pagamentos** com `amount_paid` ≠ valor agendado restantes (depois de aplicar o fix abaixo).

### Correção em 2 frentes

#### 1. Guard de duplicidade tratar `NULL` ≡ chave canônica derivada do `installment_number`

Em `manualPaymentService.findExistingActivePayment`: ao buscar duplicatas, considerar **ambas as formas** da chave para a mesma parcela:
- Para `installment_number = 0`: chaves equivalentes = `["entrada", NULL]` (não considera `entrada_2/3` — esses são parcelas distintas legítimas em multi-entrada).
- Para `installment_number ≥ 1`: chaves equivalentes = `[String(installment_number), NULL]`.

Query passa a usar `.or()` cobrindo as duas variantes simultaneamente, antes de validar com `.eq("installment_number", ...)`.

**Importante**: para `installment_key` começando com `entrada_` (multi-entrada), NÃO aplicar a equivalência com NULL — são parcelas independentes.

#### 2. Migration one-shot — cleanup das 4 duplicatas restantes + revalidação

```sql
-- Marcar as baixas mais antigas como superseded
UPDATE manual_payments SET status='superseded',
  review_notes='Substituída por baixa posterior — duplicidade NULL/key (round 3)'
WHERE id IN (
  'dede2e2a-8451-4e79-92df-911003f2cfe0', -- Natani entrada antiga
  '6328fb9b-ce42-4096-a243-476a7bc531f5', -- c888ddf6 parc 1 NULL antiga
  'a7afd689-b2ea-4758-8cfb-820c30820ea5', -- e66340e7 entrada 136,36 antiga
  'f2e424c6-754a-40fa-9fa7-6f37f3f502c3'  -- e66340e7 parc 2 antiga
);

-- Reverter clients.valor_pago (decrementar 865,42 distribuído por cliente)
-- + re-avaliar agreements.status (se algum tinha virado completed por overpayment)
-- + log client_events 'manual_payment_superseded'

-- Sincronizar custom_installment_values com a baixa que ficou (especialmente Ezi: 144,42)
```

#### Validação dos números do dashboard pós-correção

Após aplicar:
- Total `manual_payments confirmed`: 189 (era 193 → −4 superseded).
- Soma `amount_paid` confirmados: −R$ 865,42 vs. estado atual.
- Acordo da Ezi (`e66340e7`) agora mostra entrada = R$ 144,42 (valor real recebido) e parcela 2 = R$ 136,36, com 1 baixa cada.
- RPC `get_dashboard_stats` (que lê `manual_payments` confirmed + `negociarie_cobrancas` pago) refletirá o valor correto automaticamente.

### Teste end-to-end (admin altera valor → baixa correta)

Após o deploy, rodar este cenário no preview:
1. Abrir aba **Confirmação de Pagamento** → criar baixa pendente para uma parcela de teste com valor R$ 200,00 (parcela agendada R$ 195,00).
2. Confirmar como admin → verificar:
   - `manual_payments.amount_paid` = 200,00 ✓
   - `agreements.custom_installment_values[key]` = 200,00 ✓ (sync já implementado)
   - UI do detalhe do acordo mostra parcela como **R$ 200,00** ✓
   - `clients.valor_pago` incrementou +200,00 (não +195,00) ✓
3. Editar via lápis para R$ 198,00 → repetir verificações com novo valor.
4. Tentar criar 2ª baixa para mesma parcela → diálogo bloqueia ✓ (já implementado).
5. Tentar criar baixa com `installment_key=NULL` (legado) quando já existe `"1"` → guard novo bloqueia ✓.

### Arquivos alterados

- `src/services/manualPaymentService.ts` — `findExistingActivePayment` cobre equivalência `NULL ↔ chave canônica` para entrada/parcela numerada (excluindo `entrada_2/3`).
- Migration SQL one-shot — superseded das 4 duplicatas reais + revert valor_pago + revalidate status + sync custom_installment_values do Ezi.

### Validação manual pós-deploy

1. Dashboard: comparar "Total Recebido" antes/depois (deve cair R$ 865,42).
2. Acordo da Ezi: entrada = **R$ 144,42**, parcela 2 = **R$ 136,36**, sem duplicatas no histórico.
3. Acordo Natani / `c888ddf6`: 1 baixa cada, valor correto.
4. Raiane (`079bb3e1`) e Samantha (`c7493649`): **mantêm** ambas as entradas — verificar que NÃO foram marcadas como superseded.
5. Teste end-to-end (acima) passa sem erro.

### Fora de escopo

- Mexer nas 2 baixas pendentes de Maria de Fátima / Edivania (admin precisa decidir).
- Refatorar `manualPaymentService.confirm` para transação atômica (revisão arquitetural separada).
- Adicionar constraint UNIQUE no banco (`agreement_id, installment_number, installment_key`) — bloquearia inclusive o caso multi-entrada legítimo, precisa modelagem antes.

