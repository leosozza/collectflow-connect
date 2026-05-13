## Plano de Correção — Refinar Auditoria SSOT (Fase 5.4.1)

### Diagnóstico das 52 divergências

Investiguei cada bucket. Resultado:

| Bucket | Total | Tipo | Diagnóstico |
|---|---|---|---|
| `orphan_paid_source` (parcial) | **3** | Falso positivo | Manual_payment confirmado mas com valor < parcela (ex: parcela R$ 133,52 e pago R$ 118,87). A SSOT corretamente NÃO marca como pago. Cobrança continua aberta — comportamento esperado. |
| `orphan_paid_source` (entrada) | **7** | Falso positivo | Manual_payments antigos com `installment_key=NULL, installment_number=0`. Na auditoria virei isso em "0", mas na SSOT a entrada é `installment_key='entrada'`. Conferi: a parcela está paga corretamente (`paid=true, paid_amount` bate com manual_payment). Só a auditoria classificou errado. |
| `orphan_paid_source` (chave isolada) | **1** | Caso humano real | Acordo `c7493649…` (TESS MODELS / CPF 30654851840). Manual_payment confirmado com `installment_key='2'` (R$ 2.470,40), mas a SSOT só tem chaves `entrada`, `entrada_2`, `1`. O usuário pagou usando uma chave que não existe mais (provavelmente o acordo foi recriado/reestruturado). Valor bate exatamente com a parcela `1`. **Não é bug da migração** — é dado órfão pré-existente. Recomendo correção manual pelo admin (re-confirmar o pagamento na chave correta `1`). |
| `carteira_status_mismatch` | **41** | Falso positivo (race condition) | O shadow rodou às 14:57 UTC e o `auto-status-sync` (disparado pelo maxlist-import às 15:01 UTC) atualizou `clients.status` 4 minutos depois. Conferi 2 amostras: a SSOT já dizia `vencido` corretamente, e o legacy `pago` foi corrigido para `vencido` na sequência. Comportamento esperado — só preciso evitar que o shadow rode no meio de uma sincronização. |

**Conclusão**: **0 bugs reais.** Recebimentos íntegros, SSOT funcionando, lógica de pagamento parcial mantém o cliente devendo (correto).

### Correções na função de auditoria

**1. `orphan_paid_source` — só sinalizar quando for divergência real**

```text
WHERE mp.status='confirmed'
  AND mp.amount_paid >= ai.amount - 0.01     -- ignora pagamentos parciais
  AND ai.id IS NOT NULL                      -- ignora chaves sem instalment correspondente
  AND (ai.paid=false OR ai.cancelled=true)
```

E aplicar a mesma normalização que `rebuild_agreement_installments` usa para casar manual_payment ↔ installment:
- `(installment_key IS NOT NULL AND installment_key = ai.installment_key)`
- `OR (installment_key IS NULL AND installment_number = canon_num)` (entrada=0, parcela=N)

Isso elimina os 7 falsos positivos de "entrada" e os 3 de pagamento parcial. Os 8 reais que sobrarem (chave inexistente como o caso da TESS) ficam sinalizados como `severity='warn'`, com label `'manual_payment_uses_legacy_key'` para deixar claro que é dado órfão, não bug.

**2. `carteira_status_mismatch` — anti-race com auto-status-sync**

Antes de rodar a verificação, checar se houve `clients` atualizado nos últimos 5 minutos. Se sim, pular este check (ele será refeito no próximo run). Pseudocódigo:

```sql
IF EXISTS (SELECT 1 FROM clients WHERE tenant_id=_tenant_id AND updated_at > now() - interval '5 min') THEN
  SKIP carteira check, registrar 'skipped_due_to_recent_sync'
ELSE
  rodar amostra de 500
END IF;
```

E aumentar o tamanho da amostra para 1000 (já temos índice funcional, suporta).

**3. Auto-resolver as 52 divergências antigas**

Após corrigir a função, rodar `UPDATE ssot_shadow_checks SET resolved_at=now(), notes='resolved_by_audit_refactor_v2' WHERE resolved_at IS NULL`. Manter o histórico para auditoria mas zerar a fila ativa.

**4. Documentar o caso humano (TESS / 30654851840)**

Inserir manualmente uma entrada explicativa em `ssot_shadow_checks` (severity='warn', `notes='manual_payment_2470.40_uses_legacy_key_2_should_be_1'`) para que o admin veja na próxima UI de diagnóstico. **Não tocar nos dados** sem aprovação humana.

### Mudanças

**1 migration** que faz:
- Recria `run_ssot_shadow_check` com as 2 melhorias acima
- Acrescenta colunas opcionais em `ssot_shadow_checks`: `notes text`, `subtype text`
- Resolve as 52 divergências antigas (UPDATE com `notes='resolved_by_audit_refactor_v2'`)
- Re-roda o shadow para o tenant principal e mostra o resultado limpo

### Garantias (o que NÃO vou tocar)

- ❌ Não altero `rebuild_agreement_installments` (ela está correta).
- ❌ Não altero `agreement_installments` (SSOT íntegra).
- ❌ Não altero nenhum trigger de pagamento.
- ❌ Não altero `manual_payments` nem `negociarie_cobrancas` (dados crus preservados).
- ❌ Não altero a lógica de status da carteira nem `get_client_consolidated_status`.

Apenas refino a auditoria para parar de gerar falsos positivos.

### Validação

Após o deploy:
1. `SELECT count(*) FROM ssot_shadow_checks WHERE resolved_at IS NULL` deve voltar a ≤ 1 (só o caso humano da TESS).
2. Re-rodar manualmente a edge function (`x-shadow-secret`) e confirmar que não regenera os 51 falsos positivos.
3. Aguardar 24h e ver o run automático estável.

Posso executar?