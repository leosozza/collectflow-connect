

# Corrigir indicador de SLA para instâncias da API Oficial

## Problema

O SLA já está sendo calculado e armazenado corretamente no banco (`sla_deadline_at`). A instância Gupshup tem `provider_category = 'official'` no banco, mas o frontend verifica `provider_category === 'official_meta'`. Como nunca bate, o relógio de SLA e o countdown no topo nunca aparecem.

## Correção

Atualizar todas as verificações no frontend para aceitar tanto `"official_meta"` quanto `"official"`:

| Arquivo | Linha | Mudança |
|---|---|---|
| `src/components/contact-center/whatsapp/ConversationList.tsx` | ~429 | `inst?.provider_category === "official_meta"` → incluir `"official"` |
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | ~410 | `selectedInstance?.provider_category === "official_meta"` → incluir `"official"` |

Em ambos os casos, a verificação passará a ser:
```typescript
const isOfficial = inst?.provider_category === "official_meta" || inst?.provider_category === "official";
```

Nenhuma mudança no backend ou banco necessária — o cálculo de SLA já funciona corretamente.

