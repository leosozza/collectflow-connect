# Plano: Cron Negociarie + Regras estruturais de acordo

Vamos executar nas duas frentes pendentes, na ordem: primeiro o cron (rápido, isolado), depois as regras estruturais.

---

## Frente 1 — Cron automático Negociarie (12/12h)

**Objetivo:** garantir baixas mesmo quando o webhook da Negociarie falhar/não disparar, varrendo todos os tenants ativos 2x por dia.

### 1.1 Nova edge function `negociarie-sync-all`
- Sem JWT (chamada por pg_cron)
- Valida header `x-cron-secret` contra secret `CRON_SECRET`
- Lista todos os `tenants` ativos + para cada tenant lista credores com `cobrança_direta_ativa=true` + a conta master do tenant
- Para cada (tenant, credor|master) chama internamente a mesma rotina de `negociarie-sync-payments` com `days=3` (janela curta, roda a cada 12h)
- Loga resumo em `audit_logs` (`action='negociarie_cron_sync'`, metadata com scanned/matched/processed por escopo)
- Retorna JSON com totais agregados

### 1.2 Schedule via pg_cron
SQL via tool `insert` (não migration — contém URL+anon):
```sql
select cron.schedule(
  'negociarie-sync-all-12h',
  '0 3,15 * * *',  -- 00h e 12h BRT (UTC-3)
  $$ select net.http_post(
       url:='https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/negociarie-sync-all',
       headers:='{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
       body:='{}'::jsonb
  ) $$
);
```
Habilitar `pg_cron` e `pg_net` se ainda não estiverem.

### 1.3 Secret
Pedir `CRON_SECRET` ao usuário via secrets tool antes de criar a function.

---

## Frente 2 — Regras estruturais (caso Gabriella)

### 2.1 Cancelar boletos no gateway ao quebrar acordo

**Trigger:** quando `agreements.status` muda para `broken` ou `cancelled`.

**Comportamento:**
- Buscar todas `agreement_installments` `paid=false` do acordo
- Para cada uma com `negociarie_cobranca_id` (ou outro gateway): chamar edge function `cancel-agreement-boletos` que itera e cancela no provedor correto (Negociarie / Asaas)
- Respeitar `credores.prazo_dias_acordo`: se a parcela ainda está dentro do prazo (data_vencimento + prazo_dias_acordo > hoje), NÃO cancela ainda — agenda cancelamento; se já passou, cancela imediatamente
- Marcar `agreement_installments.gateway_status='cancelled'` + log em `audit_logs`

**Implementação:**
- Nova edge function `cancel-agreement-boletos` (chamada pelo trigger via `pg_net` ou pelo código quando admin quebra/cancela acordo)
- Trigger DB `trg_cancel_boletos_on_break` em `AFTER UPDATE OF status ON agreements` que dispara `pg_net.http_post` para a function
- Mantém `payment_after_break` funcionando: se boleto não foi cancelado a tempo e cliente pagar, fluxo atual (notificação + flag) continua válido

### 2.2 Saldo devedor real no novo acordo

**Cenário:** cliente quebrou acordo após pagar parcelas; novo acordo deve usar saldo restante, não dívida original.

**Implementação:**
- Nova função SQL `get_client_real_balance(_tenant_id, _client_cpf, _credor_id)`:
  - Soma `clients.valor_atualizado` (dívida original do credor)
  - Subtrai SUM de `manual_payments` + `portal_payments` + `negociarie_cobrancas` (status pago) do CPF+credor que NÃO estão vinculados a acordos vigentes
  - Retorna `{ saldo_devedor, total_pago_historico, parcelas_quitadas }`
- `AgreementForm.tsx`: ao abrir form de novo acordo, chamar essa RPC e pré-popular o campo "valor base" com `saldo_devedor` em vez de `valor_atualizado` bruto. Mostrar banner: "Cliente já pagou R$ X em acordos anteriores. Saldo base: R$ Y"
- Recálculo de juros/multa aplica em cima do saldo, não da original

### 2.3 Documentação memory
Atualizar `mem://logic/agreements/payment-after-break` adicionando seção sobre cancelamento automático + nova memory `mem://logic/agreements/real-balance-calculation`.

---

## Ordem de execução
1. Pedir secret `CRON_SECRET`
2. Criar `negociarie-sync-all` + agendar cron
3. Validar com curl manual
4. Criar `cancel-agreement-boletos` + trigger
5. Criar RPC `get_client_real_balance` + ajustar `AgreementForm`
6. Atualizar memories

## Detalhes técnicos
- Trigger usa `pg_net` async (não bloqueia UPDATE)
- Edge functions com `verify_jwt=false` no `config.toml` (cron + trigger interno)
- `cancel-agreement-boletos` recebe `{ agreement_id }` e roteia por `negociarie_cobranca_id` (Negociarie) ou `asaas_charge_id` (Asaas)
- RPC `get_client_real_balance` é SECURITY DEFINER com `can_access_tenant` guard
- Sem alteração em fluxos existentes de pagamento/baixa — apenas adições defensivas
