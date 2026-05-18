# Cancelar parcela de acordo — sem quebrar acordo

## Contexto

A base de cancelamento por parcela **já existe** (`agreementService.cancelInstallment`, dialog em `AgreementInstallments.tsx`, coluna `cancelled_installments` jsonb, propagação via trigger `rebuild_agreement_installments` para a SSOT `agreement_installments.cancelled`, classifier ignora canceladas, dashboard/`get_client_consolidated_status` também).

Faltam 3 peças críticas pedidas:

1. **Cancelar o boleto da parcela no gateway** (Negociarie hoje, Asaas no futuro).
2. **Recalcular `proposed_total`** descontando a parcela cancelada.
3. **Bloqueios + motivo obrigatório + UX** consistentes.

Nada do que existe será removido — só estendido. Reativação continua existindo mas com restrições.

## O que será feito

### 1. Edge function `cancel-installment-boleto` (nova)

Cancela **um único** boleto, identificado por `negociarie_cobrancas.id` (uuid interno). Reusa exatamente a mesma lógica de credenciais e DELETE da `cancel-agreement-boletos` (já trata 404 como idempotente). 

- Auth: `x-cron-secret` OU service_role bearer (mesmo padrão da `cancel-agreement-boletos`).
- Body: `{ cobranca_id: uuid, tenant_id: uuid, reason?: string }`.
- Após sucesso: marca `negociarie_cobrancas.status='CANCELADO'`, registra em `audit_logs` com `action='cancel_installment_boleto'`.
- Resposta inclui `{ ok, gateway: "negociarie", skipped_reason? }`.

Asaas fica preparado mas **não implementado nesta entrega** (stub que retorna `gateway_unsupported` — o cancelamento da parcela continua, só não cancela o boleto). Quando Asaas entrar como gateway de acordo, adicionamos o branch.

### 2. `agreementService.cancelInstallment` — endurecer

Refatorar para:

```text
1. Carregar agreement + SSOT row da parcela (installment_key).
2. Bloqueios (lançam erro amigável):
   - agreement.status in ('completed','cancelled','broken')  → "Acordo já encerrado"
   - SSOT.paid = true                                          → "Parcela já paga"
   - SSOT.pending_confirmation = true                          → "Há pagamento aguardando confirmação"
   - SSOT.cancelled = true                                     → "Parcela já está cancelada"
3. Localizar boleto ativo: negociarie_cobrancas WHERE agreement_id, installment_key,
   status NOT IN ('PAGO','CANCELADO').
4. Se houver boleto → invocar edge cancel-installment-boleto.
   Falha do gateway → ABORTA o cancelamento (não grava nada) e retorna erro claro.
5. Atualizar agreements em uma única chamada:
   - cancelled_installments[key] = { cancelled_at, cancelled_by, reason, boleto_cancelled, gateway }
   - proposed_total = proposed_total - SSOT.amount
   - (NÃO mexer em original_total — preserva histórico contratual)
6. Trigger rebuild_agreement_installments já propaga cancelled=true e aggregates.
7. Inserir client_events 'installment_cancelled' com metadata estendida.
8. logAction (audit) com diff de proposed_total.
```

### 3. Reativação — restringir

`reactivateInstallment` passa a:

- Bloquear se `cancelled_installments[key].boleto_cancelled === true` (boleto Negociarie cancelado é destrutivo — não dá pra "descancelar"; operador precisa gerar nova parcela manualmente).
- Restaurar `proposed_total += amount` da SSOT (ou do snapshot salvo no jsonb).
- Auditoria + client_events 'installment_reactivated'.

### 4. UI — `AgreementInstallments.tsx`

- Dialog de cancelamento ganha:
  - **Textarea "Motivo" obrigatório** (mínimo 5 chars).
  - **Alerta** quando há boleto ativo: *"Esta parcela tem boleto ativo no Negociarie. Ele será cancelado automaticamente e não poderá ser restaurado."*
  - **Linha de impacto**: *"O total do acordo será reduzido de R$ X para R$ Y."*
- Botão "Cancelar parcela" desabilitado (com tooltip) quando bloqueios da seção 2 se aplicam — hoje só checa `isPaid && pending_confirmation`; adicionar checagem de status do acordo.
- Botão "Reativar" some quando `boleto_cancelled`.

### 5. Invalidações de cache (já existem, completar)

Adicionar `["agreement-installments-ssot", agreementId]` e `["agreement-cobrancas", cpf, agreementId]` aos `invalidateQueries` do cancel/reactivate (hoje só invalidam `client-agreements` e `client-detail`).

## Pontos analisados que NÃO quebram

- **SSOT**: `rebuild_agreement_installments` já lê `cancelled_installments` jsonb e seta `cancelled` ao recriar. Mudar `proposed_total` não afeta a tabela de parcelas (campo não é input do rebuild).
- **Status consolidado**: `get_client_consolidated_status` usa SSOT excluindo canceladas — convergente.
- **Dashboard / Recebido**: lê UNION de pagamentos brutos — cancelar parcela nunca afeta valor recebido.
- **Quebra de acordo (>15 dias atraso)**: parcelas canceladas são excluídas do classifier, então cancelar uma parcela vencida **não** mascara quebra real das demais.
- **Trigger `trg_cancel_boletos_on_break`**: só dispara em mudança de status do acordo — não conflita.
- **Aggregates Fase 4** (`paid_count`, `total_count`, etc.): `trg_agreement_installments_aggregate` já recalcula a partir da SSOT (que ignora canceladas).
- **Carteira agrupada**: invalidação `["carteira-grouped"]` já inclusa.
- **Cron Negociarie 12h**: re-sincroniza por `id_parcela`. Como marcamos `status='CANCELADO'` localmente E no gateway, o cron não vai "ressuscitar" a cobrança.

## Edge cases tratados

| Cenário | Comportamento |
|---|---|
| Parcela única do acordo | Cancelar reduz proposed_total a 0 → bloquear e sugerir "Quebrar acordo" |
| Parcela é entrada | Permitido; reduz proposed_total e mantém `entrada_value` original para histórico |
| Boleto vencido mas não pago | Cancela normalmente no gateway |
| Gateway fora do ar | Erro 5xx → abortar, nada é gravado, toast pede retry |
| Credor não tem Negociarie | Não há boleto a cancelar; segue só o lado local |
| Acordo broken com janela de graça | Bloqueia (acordo já encerrado) |
| Dois cancelamentos concorrentes | Update otimista falha no 2º; UI mostra "Parcela já cancelada" |

## Permissões

Mantém aberto a operador + admin **por enquanto** (não foi solicitada restrição). Fica registrado em audit_logs + client_events quem cancelou.

## Arquivos afetados

```text
supabase/functions/cancel-installment-boleto/index.ts   (NOVO)
src/services/agreementService.ts                        (cancelInstallment, reactivateInstallment)
src/components/client-detail/AgreementInstallments.tsx  (dialog + bloqueios + alerts)
.lovable/memory/logic/agreements/installment-key-canonical.md  (nota sobre cancel + gateway)
```

Nenhuma migração de schema necessária (campos já existem).

## Como vou validar

1. Cenário feliz: cancelar parcela mensal com boleto Negociarie → boleto vai a CANCELADO no gateway, SSOT marca cancelled, proposed_total reduz, classifier ignora.
2. Tentar cancelar parcela paga → bloqueio claro.
3. Tentar cancelar com pendência manual → bloqueio.
4. Tentar reativar parcela com boleto já cancelado → bloqueio.
5. Verificar via `cloud_status` + curl da nova edge function que retorno 200 quando idempotente (boleto 404).
6. Confirmar que `get_client_consolidated_status` da carteira não muda para um cliente com só uma parcela cancelada.
