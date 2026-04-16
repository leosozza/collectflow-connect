
# Correção MaxList YBRASIL — Cheque Devolvido, Total Pago e Em Aberto

## Causa raiz

**Backend (`supabase/functions/maxlist-import/index.ts`):**
- Linha 311: `hasPagamento` é `true` sempre que existe `PaymentDateEffected` (folha de cheque entregue).
- Linha 344: `valor_pago` é preenchido com o valor da parcela quando `hasPagamento`, **independente de existir `CheckReturnDateQuery`**. Resultado: parcela com cheque devolvido fica `status=vencido` mas `valor_pago = valor_parcela`.
- Linha 360: `tipo_divida_id` é mapeado por `PaymentType`. Códigos `3` (Débito) e `4` (Crédito) caem em "cartão de crédito". Se o MaxSystem devolver PaymentType atípico para um cheque, o tipo errado é gravado.
- Linhas 451-460: a exceção `isExistingEmpty` permite sobrescrever `tipo_divida_id` mesmo estando em `PROTECTED_FIELDS`, propagando o erro.

**Frontend (`src/components/client-detail/ClientDetailHeader.tsx`):**
- Linha 225: `totalPagoRecords` soma `valor_pago` de TODOS os registros — inclui devolvidos.
- Linhas 239-240: `totalSaldo` exclui apenas `status === "pago"` — devolvidos (status=vencido) entram corretamente.
- Linha 283: `totalAberto = totalSaldo - totalPagoRecords` — fórmula global mascara: como o devolvido é contado em ambos (saldo +valor e totalPago +valor_pago), o resultado fica zerado.

**Frontend (`src/pages/ClientDetailPage.tsx`):**
- Linhas 421-422: saldo da linha = `valor_parcela - valor_pago` → para devolvido mostra R$ 0,00 quando deveria mostrar valor cheio.

## Correções

### 1. `supabase/functions/maxlist-import/index.ts`

**A. Zerar `valor_pago` quando há devolução (linha 344):**
```ts
const isDevolvido = !!rawReturnDate;
// ...
valor_pago: (hasPagamento && !isDevolvido) ? (record.valor_parcela || record.valor_saldo || 0) : 0,
```

**B. Não mapear cheque para cartão de crédito quando há devolução (linha 360):**
- Se `isDevolvido`, forçar `tipo_divida_id` para o tipo "cheque" (resolvido via map), ignorando o `PaymentType` que pode vir como 3/4.
- Subsidiariamente, **remover a exceção `isExistingEmpty`** para `tipo_divida_id` (manter campo realmente protegido após primeira definição correta), evitando sobrescrita futura.

**C. Update mode (linhas 451-460):** garantir que `valor_pago` seja sempre atualizado quando o registro vira devolvido (deve recalcular para 0). Como `valor_pago` não está em `PROTECTED_FIELDS`, já entra no diff — apenas confirmar que a comparação atualiza corretamente.

**D. Auditoria:** preservar `data_pagamento` original apenas como histórico (já está); adicionar nota em `motivo_devolucao` ou log se necessário.

### 2. `src/components/client-detail/ClientDetailHeader.tsx`

**A. Total Pago — excluir devolvidos (linha 225):**
```ts
const totalPagoRecords = clients.reduce((sum, c) => {
  const isDevolvido = !!(c as any).data_devolucao;
  if (isDevolvido) return sum;
  return sum + Number(c.valor_pago);
}, 0);
```

**B. Em Aberto — soma direta por parcela elegível (substituir linha 283):**
```ts
const totalAberto = clients.reduce((sum, c) => {
  const isDevolvido = !!(c as any).data_devolucao;
  const isPago = c.status === "pago" && !isDevolvido;
  const isCancelado = c.status === "cancelado_maxlist" || c.status === "quebrado";
  if (isPago || isCancelado) return sum;
  // pendente, vencido, em_acordo, devolvido
  const valorBase = Number(c.valor_saldo) || Number(c.valor_parcela) || 0;
  const pago = isDevolvido ? 0 : Number(c.valor_pago) || 0;
  return sum + Math.max(0, valorBase - pago);
}, 0);
```

**C. Saldo Devedor — incluir devolvidos no `naoPageos` (linha 239):** já inclui (status=vencido), apenas garantir valor cheio quando devolvido (não subtrair `valor_pago`):
```ts
const totalSaldo = naoPageos.reduce((sum, c) => {
  const isDevolvido = !!(c as any).data_devolucao;
  const valorBase = Number(c.valor_saldo) || Number(c.valor_parcela) || 0;
  const pago = isDevolvido ? 0 : Number(c.valor_pago) || 0;
  return sum + Math.max(0, valorBase - pago);
}, 0);
```

**D. Tipo de Dívida no header:** se houver múltiplos `tipo_divida_id` distintos nos `clients`, exibir o mais frequente (não o do `client[0]`). Pequena agregação:
```ts
// substituir client.tipo_divida_id pela moda
```

### 3. `src/pages/ClientDetailPage.tsx` (linha 421-422)

```ts
const hasDevolucao = !!(c as any).data_devolucao;
const valorEfetivo = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
const pagoLinha = hasDevolucao ? 0 : Number(c.valor_pago);
const saldoDevedor = Math.max(0, valorEfetivo - pagoLinha);
```
Coluna "Pago" passa a usar `pagoLinha` (mostra R$ 0,00 para devolvido).

### 4. `auto-status-sync` (Edge Function)

Verificar se a função já trata devolvidos como "em aberto". Como passamos a gravar `valor_pago=0` e `status=vencido` para devolvidos, o auto-status-sync atual (que considera parcelas vencidas) já deve marcar o cliente como INADIMPLENTE corretamente — sem alteração necessária. Validar com um log/teste após deploy.

### 5. Backfill (one-shot SQL via migration insert)

Para corrigir registros já importados no YBRASIL com `data_devolucao IS NOT NULL`:
- `UPDATE clients SET valor_pago = 0 WHERE tenant_id = '<ybrasil>' AND data_devolucao IS NOT NULL;`
- Re-executar `auto-status-sync` para o tenant.

## Arquivos alterados

1. `supabase/functions/maxlist-import/index.ts` — derivação de `valor_pago`, `tipo_divida_id`, proteção do campo no update.
2. `src/components/client-detail/ClientDetailHeader.tsx` — recálculo de `totalPagoRecords`, `totalSaldo`, `totalAberto`, e tipo_divida agregado.
3. `src/pages/ClientDetailPage.tsx` — cálculo por linha respeitando devolução.
4. Migração SQL única (backfill) para zerar `valor_pago` de devolvidos existentes + invocar `auto-status-sync`.

## Risco / análise de quebra

- **Nenhuma quebra de lógica esperada.** As mudanças são aditivas/condicionais (`if devolvido`) e preservam comportamento atual para parcelas sem devolução.
- **Reabertura de parcelas (feature recente)** continua funcionando — o handler já chama `auto-status-sync`.
- **Acordos/`agreements`** não são afetados; somam-se separadamente em `totalPagoAcordos`.
- **Backfill** é idempotente (só zera onde `data_devolucao IS NOT NULL`).
- **Update mode**: ao reimportar, registros já corretos não geram diff (graças ao chunk diff existente), evitando flood de logs.

## Critérios de aceite cobertos

1. ✅ Devolvido fora de TOTAL PAGO (header + backend)
2. ✅ Devolvido em EM ABERTO (header)
3. ✅ Linha mostra saldo devedor real (page)
4. ✅ Status INADIMPLENTE via `auto-status-sync` (já reaproveitado)
5. ✅ Tipo de dívida não vira cartão indevidamente (forçar cheque + remover exceção isExistingEmpty)
6. ✅ Atualizar parcelas mantém consistência (`valor_pago=0` na origem)
7. ✅ Funciona para import e update
