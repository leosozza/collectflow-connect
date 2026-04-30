## Quebra em 2 estágios + cancelamento automático na Negociarie

### Parte 1 — Métrica de Quebra com 2 estágios

**Total de Quebra** no Dashboard passa a somar parcelas em dois estágios:

#### Estágio 1 — Quebra Provisória (reversível)
- Vencimento dentro do mês alvo
- Atraso entre **3 e 10 dias** (`due_date BETWEEN CURRENT_DATE - 10 AND CURRENT_DATE - 3`)
- Acordo ainda **vivo** (`status IN ('pending','approved','overdue')`)
- Sem pagamento confirmado

Sai automaticamente quando:
- Pagamento confirmado → vai para Total Recebido
- Operador altera a data da parcela para o futuro → volta para Pendentes

#### Estágio 2 — Quebra Definitiva (irreversível)
- Acordo `cancelled` (`auto_expired` ou `manual`) com vencimento ≤ data de cancelamento, **OU**
- Atraso > 10 dias, mesmo com acordo ainda não cancelado pelo job

```text
Vencimento futuro       → Pendentes
Atraso 0-3 dias         → Pendentes
Atraso 4-10 dias (vivo) → Quebra (provisória, reversível)
Atraso >10 dias         → Quebra (definitiva)
Acordo cancelado        → Quebra (definitiva)
Pagamento confirmado    → Total Recebido
```

Sem mais gap. Pendentes e Quebra encostam em D+3.

---

### Parte 2 — Cancelar boletos na Negociarie ao cancelar acordo

**Regra**: quando um acordo passa para `status = 'cancelled'` (auto ou manual), todas as parcelas/boletos ativos daquele acordo devem ser cancelados na Negociarie pra impedir o cliente de pagar um acordo já quebrado.

O proxy `negociarie-proxy` já tem a action `cancelar-cobranca` (PATCH idempotente, trata 404 como sucesso). Vamos usá-la em três pontos:

#### 2.1. Edge function nova: `cancel-agreement-charges`
Função utilitária reutilizável que:
1. Recebe `agreement_id` (e `tenant_id` quando chamada via service_role).
2. Busca todas as parcelas do acordo (entrada + 1..N) que ainda têm `id_parcela` na Negociarie e não estão pagas.
3. Para cada parcela: chama `negociarie-proxy` action `cancelar-cobranca` com o `id_parcela`.
4. Registra resultado em `client_events` (`type: 'agreement_charges_cancelled'`) com a lista de parcelas e status de cada cancelamento.
5. Retorna `{ cancelled: number, failed: number, details: [] }`.

#### 2.2. Acionada pelo job `auto-expire-agreements` (auto)
Após marcar o acordo como `cancelled / auto_expired`, invoca `cancel-agreement-charges` para cada acordo recém-cancelado, em paralelo limitado (chunks de ~10) pra não estourar rate limit da Negociarie.

#### 2.3. Acionada no cancelamento manual (UI)
Em `agreementService.ts` linha 529 (`update status='cancelled', cancellation_type='manual'`), após o update bem-sucedido, dispara `supabase.functions.invoke('cancel-agreement-charges', { body: { agreement_id } })` em fire-and-forget (não bloqueia a UI). Toast informa "Boletos sendo cancelados na Negociarie em background".

#### 2.4. Reativação (reversão)
Se um acordo for reaberto (`status` voltando para `approved`, linha 981 do service), **não recriamos** os boletos automaticamente — os boletos cancelados ficam cancelados, e o operador precisa gerar novos via fluxo formal de regeneração. (Comportamento conservador: evita ressuscitar cobrança que cliente já achou que foi anulada.)

---

### Arquivos

**Backend**
- `supabase/migrations/<ts>_dashboard_quebra_two_stage.sql` — reescreve blocos `_quebra` e `_quebra_mes_ant` no `get_dashboard_stats` para a lógica de 2 estágios.
- `supabase/functions/cancel-agreement-charges/index.ts` — nova função (verify_jwt=false; valida via JWT do operador OU service_role + tenant_id explícito).
- `supabase/functions/auto-expire-agreements/index.ts` — após cancelar cada acordo, invoca `cancel-agreement-charges`.

**Frontend**
- `src/services/agreementService.ts` — após o update de cancelamento manual (linha ~529), invocar `cancel-agreement-charges`.
- `src/components/dashboard/KpisGridCard.tsx` — atualizar tooltip de "Total de Quebra" descrevendo provisória vs definitiva.

---

### Pontos de atenção

- **Idempotência**: o proxy já trata 404 como sucesso, então retentativas e múltiplas chamadas pra mesma parcela são seguras.
- **Latência da UI no manual**: cancelamento dos boletos roda async — operador não precisa esperar. Em caso de falha parcial, fica registrada em `client_events` pra auditoria.
- **Memória do projeto**: vou registrar a regra "Acordo cancelado → boletos Negociarie cancelados automaticamente" em `mem://features/billing/manual-payment-confirmation.md` (já existe) ou criar entrada dedicada quando implementar.
- **Job `auto-break-overdue` e `auto-expire-agreements`**: precisamos confirmar qual dos dois é o canônico pra cancelamento por prazo. Pelo nome, `auto-expire-agreements` é o que muda `status=cancelled`; `auto-break-overdue` parece operar em `clients`. Vou verificar e plugar o cancelamento de boletos no job certo durante a implementação.
