## Ranking — contagem de acordos (excluindo auto-cancelados) e renomear "Taxa"

### 1) `src/services/gamificationService.ts` — `fetchRanking`

Atualmente já existe a busca de `agreements` por período/operador. Vou:

- Selecionar também o `id` do acordo (além de `created_by`).
- Consultar `audit_logs` para esses `entity_id` com `action='cancel'` e `entity_type='agreement'`.
- Considerar como **auto-cancelado** quando `audit_logs.user_id === agreements.created_by` (operador cancelou o próprio acordo) e **excluir da contagem**.
- Demais cancelamentos (ex.: admin cancelou o acordo do operador) **continuam contando** como acordo realizado pelo operador.

Trecho-chave:

```ts
const { data: agreementsData } = await supabase
  .from("agreements")
  .select("id, created_by")
  .eq("tenant_id", tenantId)
  .in("created_by", operatorIds)
  .gte("created_at", startDate)
  .lt("created_at", endDate);

const agreementIds = (agreementsData || []).map((a: any) => a.id);
const selfCancelledIds = new Set<string>();
if (agreementIds.length > 0) {
  const { data: cancelLogs } = await supabase
    .from("audit_logs")
    .select("entity_id, user_id")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "agreement")
    .eq("action", "cancel")
    .in("entity_id", agreementIds);

  const creatorByAgreement = new Map<string, string>();
  (agreementsData || []).forEach((a: any) => creatorByAgreement.set(a.id, a.created_by));
  (cancelLogs || []).forEach((log: any) => {
    if (creatorByAgreement.get(log.entity_id) === log.user_id) {
      selfCancelledIds.add(log.entity_id);
    }
  });
}

const agreementsCountMap = new Map<string, number>();
(agreementsData || []).forEach((a: any) => {
  if (selfCancelledIds.has(a.id)) return;
  agreementsCountMap.set(a.created_by, (agreementsCountMap.get(a.created_by) || 0) + 1);
});
```

### 2) `src/components/gamificacao/RankingTab.tsx` — renomear badge

Trocar o label do badge `🎯 {receiveRate}% taxa` por `🎯 {receiveRate}% Taxa de Conversão`.

### Observações técnicas

- Fonte da verdade do cancelamento por operador: `audit_logs` (action `cancel`, entity_type `agreement`). A tabela `agreements` não possui `cancelled_by`, então o audit log é o único caminho confiável.
- Multi-tenant preservado: todas as queries continuam com `.eq('tenant_id', tenantId)`.
- Sem mudanças de schema/migrações.
