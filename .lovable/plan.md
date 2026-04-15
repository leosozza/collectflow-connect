

# Correção: Disparo mostra "falha" mas mensagens são enviadas

## Causa raiz

O `startCampaign` no frontend faz `await supabase.functions.invoke("send-bulk-whatsapp")` e **espera** a resposta completa da Edge Function. Como a função leva minutos para processar (8-15s por mensagem × 15 = ~3 minutos), o gateway/SDK retorna timeout ("Edge Function returned a non-2xx status code"). O catch do frontend interpreta isso como falha total e mostra "0 enviados, 15 falhas", mas a Edge Function continua rodando no servidor e envia tudo normalmente.

## Solução

Mudar a estratégia para **fire-and-forget + polling**:

1. Disparar a Edge Function sem esperar o resultado completo
2. Usar o polling que já existe (a cada 5s via `pollCampaignProgress`) para acompanhar o progresso real
3. Quando o polling detectar status final (`completed`, `completed_with_errors`, `failed`), parar e mostrar o resultado baseado nos dados reais da campanha no banco

### Alteração 1: `src/services/whatsappCampaignService.ts` — `startCampaign`

Remover o loop de retry/await. Fazer uma chamada fire-and-forget (sem await do resultado, apenas dispara). Retornar imediatamente para que o UI entre em modo polling.

```typescript
export async function startCampaign(campaignId: string): Promise<void> {
  // Fire-and-forget: invoke but don't await the full response
  supabase.functions.invoke("send-bulk-whatsapp", {
    body: { campaign_id: campaignId },
  }).catch((err) => {
    // Edge function may timeout from client perspective but continues server-side
    console.warn("[startCampaign] invoke returned error (expected for long campaigns):", err.message);
  });
}
```

### Alteração 2: `src/components/carteira/WhatsAppBulkDialog.tsx` — `handleSend`

Não depender mais do retorno de `startCampaign` para montar o `result`. Em vez disso:
- Chamar `startCampaign` (que retorna imediatamente)
- Manter `sending = true` 
- O polling existente já roda a cada 5s
- Quando o polling detectar status final, preencher `result` com os dados reais do banco e setar `sending = false`

### Alteração 3: Polling finaliza a campanha no UI

No `useEffect` do polling, quando detectar status final, buscar contadores reais e setar o `result` + `setSending(false)`:

```typescript
if (["completed", "completed_with_errors", "failed"].includes(p.status)) {
  setResult({
    sent: p.sent_count,
    failed: p.failed_count,
    errors: [],
    finalStatus: p.status,
  });
  setSending(false);
  stopPolling();
}
```

### Arquivos
- `src/services/whatsappCampaignService.ts` — simplificar `startCampaign` para fire-and-forget
- `src/components/carteira/WhatsAppBulkDialog.tsx` — mover lógica de resultado para o polling

### Resultado esperado
- UI mostra progresso real em tempo real via polling
- Quando a campanha termina, mostra os contadores corretos do banco
- Sem mais "0 enviados, 15 falhas" falso — os dados vêm direto do banco de dados

