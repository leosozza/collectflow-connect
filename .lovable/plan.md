## Objetivo

Adicionar a possibilidade de **cancelar uma parcela individual** dentro de "Parcelas do Acordo", sem precisar cancelar o acordo inteiro. A parcela permanece visível na lista, **riscada (line-through)** e com status **"Cancelada"**.

## Comportamento esperado

- Ícone de lixeira (vermelho) na coluna **Ações** da tabela de parcelas.
- Disponível para parcelas regulares e entradas adicionais (entrada_2, entrada_3...).
- **Desabilitado / oculto** quando:
  - Parcela já está paga (`status = pago`) ou aguardando confirmação (`pending_confirmation`).
  - É a **única entrada** existente.
  - Existe boleto/cobrança ativa em `negociarie_cobrancas` (status diferente de `cancelado`/`substituido`) — usuário deve estornar/cancelar o boleto primeiro.
  - Parcela já está cancelada → no lugar do botão exibe um ícone "Reativar" (opcional, mesma posição).
- Confirmação via dialog: "Cancelar esta parcela? Ela continuará visível, mas marcada como cancelada e não será mais cobrada."
- Apenas usuários com permissão de edição (`canEdit`).

## Visual da parcela cancelada

- Linha inteira com `line-through` e opacidade reduzida (`opacity-60`).
- Badge de status substituído por **"Cancelada"** (cinza/neutro, ícone XCircle).
- Demais ações da linha desabilitadas (não permite gerar boleto, baixar manualmente, etc).
- Ícone de **reativar** (ex.: RotateCcw) substitui a lixeira para permitir desfazer.

## Modelo de dados

Em vez de excluir e renumerar, usamos uma nova coluna **`cancelled_installments jsonb`** em `agreements`, com a forma:

```json
{
  "2": { "cancelled_at": "2026-04-29T15:00:00Z", "cancelled_by": "<profile_id>", "reason": null },
  "entrada_2": { ... }
}
```

- A chave segue o mesmo padrão canônico de `custom_installment_dates`/`custom_installment_values` ("1", "2"... ou "entrada", "entrada_2"...).
- `new_installments` **NÃO** é alterado — a parcela continua existindo na sequência, apenas marcada.
- `total_amount` é recalculado **excluindo** parcelas canceladas (entrada + soma das parcelas cujo `customKey` não está em `cancelled_installments`).

## Efeitos derivados

- **Status do acordo**: ao cancelar parcela em aberto, o acordo recalcula se ainda está vigente. Não muda o status do acordo automaticamente — a parcela apenas deixa de contar.
- **Dashboard / Vencimentos** (`get_dashboard_vencimentos`): filtra parcelas cancelada (chave presente em `cancelled_installments`) para não aparecer em "Parcelas Programadas".
- **Cálculos de progresso** (`progressPercent`, `paidCount`, `totalInstallments`): canceladas saem do denominador.
- **Boletos**: cobranças de uma parcela cancelada são marcadas como `cancelado` em `negociarie_cobrancas` quando aplicável (a UI já bloqueia cancelar parcela com boleto ativo, então normalmente não há boleto vivo nesse momento).

## Onde mexer

### Banco
1. **Migração**: `ALTER TABLE agreements ADD COLUMN cancelled_installments jsonb NOT NULL DEFAULT '{}'::jsonb`.
2. Atualizar RPC `get_dashboard_vencimentos` para excluir parcelas cuja chave está em `cancelled_installments` (entrada + parcelas regulares).

### Backend (services)
- `src/services/agreementService.ts`:
  - `cancelInstallment(agreementId, installmentKey, reason?)` — adiciona a chave em `cancelled_installments`, recalcula `total_amount` e registra `audit_logs` + `client_events` (`installment_cancelled`).
  - `reactivateInstallment(agreementId, installmentKey)` — remove a chave do `cancelled_installments` e recalcula `total_amount`.

### Frontend
- `src/components/client-detail/AgreementInstallments.tsx`:
  - Lê `agreement.cancelled_installments` e marca cada parcela com `isCancelled` no objeto.
  - Aplica `line-through opacity-60` na linha quando `isCancelled`.
  - Substitui badge de status por "Cancelada" e desabilita ações conflitantes.
  - Adiciona botão Trash2 (cancelar) e RotateCcw (reativar) com `AlertDialog` de confirmação.
  - Ajusta cálculo de `progressPercent`, `paidCount`, `totalInstallments` para ignorar canceladas.

## Detalhes técnicos

```text
agreements:
  + cancelled_installments jsonb DEFAULT '{}'

Chave canônica reutilizada de custom_installment_dates:
  "entrada", "entrada_2", "1", "2", "3"...

Cancelar parcela "2" de [1,2,3,4]:
  cancelled_installments = { "2": { cancelled_at, cancelled_by } }
  parcelas exibidas:        1  2(risco)  3  4
  total_amount:             entrada + valor1 + valor3 + valor4
  progresso:                pagas / (4 - 1 cancelada)
```

## Fora de escopo

- Reordenação manual de parcelas.
- Cancelamento em massa de várias parcelas em uma ação.
- Cancelar a entrada principal (`entrada`) — exige recalcular o acordo.
