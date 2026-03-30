

# Plano: Finalizar Fase 1 — Robustez Operacional do Disparo WhatsApp

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/send-bulk-whatsapp/index.ts` | Status final inteligente, contadores coerentes, only pending, try/catch robusto, metadados de rastreabilidade |
| `src/services/whatsappCampaignService.ts` | Relaxar filtro `fetchEligibleInstances` (aceitar `active` OR `connected`), remover `supports_manual_bulk` |
| `src/components/carteira/WhatsAppBulkDialog.tsx` | Exibir status final com badge (completed/completed_with_errors/failed), melhorar resumo Step 4 |

## Detalhes técnicos

### 1. Edge Function — Status final inteligente + contadores

Substituir o bloco final (linhas 247-256) da `handleCampaignFlow`:

```typescript
// Determine final status
let finalStatus = "completed";
if (sent === 0 && failed > 0) finalStatus = "failed";
else if (sent > 0 && failed > 0) finalStatus = "completed_with_errors";

await supabase
  .from("whatsapp_campaigns")
  .update({
    status: finalStatus,
    sent_count: sent,
    failed_count: failed,
    // delivered_count and read_count depend on future webhook tracking (Phase 2)
    // They remain at 0 until external delivery/read status is implemented
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq("id", campaignId);
```

### 2. Edge Function — Robustez do processamento

- Envolver todo o loop de recipients num try/catch global para garantir que a campanha SEMPRE finalize com status coerente, mesmo em exceção inesperada
- Adicionar `client_cpf` ao insert de `message_logs` para rastreabilidade
- Garantir que o filtro já busca apenas `status = 'pending'` (já faz, confirmar)
- No catch individual, garantir `updated_at` sempre preenchido (já faz)

### 3. Filtro de instâncias elegíveis

Em `fetchEligibleInstances`, o filtro `.eq("supports_manual_bulk", true)` pode excluir instâncias legadas. Ajustar para:

```typescript
export async function fetchEligibleInstances(tenantId: string): Promise<EligibleInstance[]> {
  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .select("id, name, instance_name, phone_number, provider, status, provider_category")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "connected"])
    .eq("provider_category", "unofficial");
    // supports_manual_bulk removido — todas as instâncias não oficiais ativas são elegíveis

  if (error) throw error;
  return (data || []) as unknown as EligibleInstance[];
}
```

### 4. Rastreabilidade — metadados no message_logs

Adicionar `metadata` (JSONB) ao insert de `message_logs` com `campaign_id`, `instance_id`, `provider_message_id`:

```typescript
await supabase.from("message_logs").insert({
  tenant_id: tenantId,
  client_id: recipient.representative_client_id,
  client_cpf: client?.cpf || null,
  channel: "whatsapp",
  status,
  phone: recipient.phone,
  message_body: message,
  error_message: status === "failed" ? JSON.stringify(result) : null,
  sent_at: status === "sent" ? new Date().toISOString() : null,
  metadata: { campaign_id: campaignId, instance_id: recipient.assigned_instance_id, provider_message_id: providerMessageId },
});
```

### 5. UX Step 4 — Resultado com status da campanha

No `renderStep4`, após o resultado, mostrar badge com status final:
- `completed` → badge verde "Concluída"
- `completed_with_errors` → badge amarela "Concluída com falhas"
- `failed` → badge vermelha "Falhou"

Retornar `finalStatus` na resposta da edge function e exibi-lo no modal.

### 6. Deduplicação e distribuição

Já implementadas corretamente:
- CPF dedup na `CarteiraPage` (via `uniqueSelectedClients`)
- Phone dedup no `deduplicateClients`
- Round-robin no `distributeRoundRobin`

Nenhuma mudança necessária — apenas validação de que está funcionando.

## O que NÃO muda
- Contact Center, chat, conversations, chat_messages — intactos
- whatsapp-webhook — intacto
- /atendimento — intacto
- Legacy flow na edge function — preservado
- Nenhuma tabela nova ou migração necessária

