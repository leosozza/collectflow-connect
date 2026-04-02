

# Plano: Corrigir fluxo de disparo WhatsApp em lote multi-provider

## Causa Raiz

3 problemas distintos:

1. **`fetchEligibleInstances`** filtra `provider_category = "unofficial"` — ignora instâncias oficiais (Gupshup) e instâncias legadas sem categoria
2. **`send-bulk-whatsapp` (campaign flow)** usa sempre `POST {instance_url}/message/sendText/{instance_name}` (formato Evolution/Baylers) — quebra para WuzAPI e Gupshup
3. **Modal** mostra "Nenhuma instância não-oficial ativa" — texto e lógica acoplados a unofficial

## Solução

### 1. `src/services/whatsappCampaignService.ts` — Ampliar elegibilidade

Remover filtro `provider_category = "unofficial"`. Buscar todas as instâncias ativas/conectadas do tenant:

```typescript
export async function fetchEligibleInstances(tenantId: string): Promise<EligibleInstance[]> {
  const { data, error } = await supabase
    .from("whatsapp_instances" as any)
    .select("id, name, instance_name, phone_number, provider, status, provider_category")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "connected"]);
  if (error) throw error;
  return (data || []) as unknown as EligibleInstance[];
}
```

### 2. `supabase/functions/send-bulk-whatsapp/index.ts` — Envio por provider

No `handleCampaignFlow`, após resolver a instância, rotear por `inst.provider`:

- **`evolution` / `baylers`** (padrão atual): `POST {url}/message/sendText/{instance_name}` com header `apikey`
- **`wuzapi`**: `POST {url}/chat/send/text` com header `Token`, body `{ phone: "{number}@s.whatsapp.net", body: message }`
- **`gupshup`**: `POST https://api.gupshup.io/wa/api/v1/msg` com `apikey` header e form-urlencoded body (buscar `gupshup_source_number` e `gupshup_app_name` do tenant settings)
- **Fallback desconhecido**: marcar como `failed` com erro "Provider não suportado para bulk"

Extrair a lógica de envio para uma função `sendByProvider(inst, phone, message, tenantSettings)` que retorna `{ ok, result }`.

### 3. `src/components/carteira/WhatsAppBulkDialog.tsx` — UI ajustada

- Trocar mensagem de "Nenhuma instância não-oficial ativa" para "Nenhuma instância ativa encontrada"
- No badge de cada instância, mostrar o provider real: `Baylers`, `WuzAPI`, `Gupshup`, etc.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/services/whatsappCampaignService.ts` | Remover filtro `provider_category` |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Roteamento de envio por provider |
| `src/components/carteira/WhatsAppBulkDialog.tsx` | Texto e badge ajustados |

Nenhuma alteração em banco, tabelas ou fluxo de negócio. O fluxo da carteira (selecionar → modal → mensagem → instâncias → campanha → enviar) permanece idêntico.

