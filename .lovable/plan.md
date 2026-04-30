# Alerta visual para mensagens não confirmadas (WhatsApp não-oficial)

## Objetivo
Sinalizar visualmente, dentro do bubble da mensagem outbound, quando uma mensagem permanece em status `sent` (1 check) por mais de **30 minutos** sem evoluir para `delivered` (2 checks) ou `read` (2 checks azuis). Isso indica forte suspeita de não-entrega no aparelho do destinatário (cenário do Cleidson/Keite).

## Escopo
- Apenas frontend, em `src/components/contact-center/whatsapp/ChatMessage.tsx`.
- Apenas mensagens **outbound**, **não internas**, **não falhadas**, com `status === "sent"`.
- Apenas para canal **não-oficial** (`isOfficialApi === false`). Na API oficial Meta, "sent" também evolui rápido, mas vamos limitar à não-oficial para evitar ruído.
- **Zero impacto** em mensagens já entregues/lidas, em mensagens de outras direções, no envio, no banco e em edge functions.

## Comportamento
- Threshold: `STUCK_THRESHOLD_MS = 30 * 60 * 1000` (30 min).
- Cálculo: `Date.now() - new Date(message.created_at).getTime() > STUCK_THRESHOLD_MS`.
- Quando a condição é verdadeira:
  - O ícone de status atual (1 check) é substituído por um pequeno badge inline `⚠ Não confirmado` em `text-amber-600` (laranja, dentro do padrão RIVO).
  - Tooltip ao passar o mouse:
    > "A mensagem foi enviada ao WhatsApp, mas o aparelho do destinatário ainda não confirmou o recebimento há mais de 30 minutos. Pode indicar bloqueio, número inválido ou aparelho offline. Considere reenviar por outro canal."
- Re-render automático: usar o mesmo padrão de `setTimeout` já existente no arquivo (linhas 93-100) para forçar re-render exatamente quando a mensagem cruza o threshold, sem polling global.

## Mudanças técnicas

**Arquivo:** `src/components/contact-center/whatsapp/ChatMessage.tsx`

1. Adicionar constante `STUCK_THRESHOLD_MS = 30 * 60 * 1000` próximo de `EDIT_WINDOW_MS`.
2. Calcular flag derivada:
   ```ts
   const isStuckSent =
     !isOfficialApi &&
     isOutbound &&
     !isInternal &&
     !isDeleted &&
     !isOptimistic &&
     message.status === "sent" &&
     ageMs > STUCK_THRESHOLD_MS;
   ```
3. Adicionar um segundo `useEffect` com `setTimeout` para re-render quando faltar `STUCK_THRESHOLD_MS - ageMs` ms (espelhando o efeito existente para `EDIT_WINDOW_MS`).
4. No bloco de footer (linhas 485-499), envolver a renderização atual em um condicional:
   - Se `isStuckSent` → renderizar `<Tooltip>` com `<span className="text-[10px] font-medium text-amber-600 dark:text-amber-500 inline-flex items-center gap-0.5">⚠ Não confirmado</span>` no lugar do `statusIcons["sent"]`.
   - Caso contrário → manter o comportamento atual (ícone + tooltip de erro para `failed`).
5. Importar `AlertTriangle` de `lucide-react` (já há `AlertCircle`; vamos reaproveitar `AlertCircle` para evitar novo import e manter o bundle limpo).

## Por que essa abordagem é segura
- **Read-only no estado**: nada é gravado em banco, edge function ou storage.
- **Determinístico**: depende só de `created_at` e `status` (já existentes em `chat_messages`).
- **Auto-corrige**: assim que o webhook do provedor atualizar `status` para `delivered`/`read`, o badge desaparece naturalmente no próximo render via realtime.
- **Sem polling**: o `setTimeout` é por mensagem montada, com cleanup no unmount, igual ao padrão já validado em produção neste arquivo.
- **Escopo restrito**: oficial Meta fica fora; mensagens já entregues/lidas/falhadas ficam fora.

## Diagrama do fluxo de status

```text
created_at -----[ageMs]-----> agora
status="sent"
   │
   ├── ageMs ≤ 30min   → ícone Check cinza (comportamento atual)
   └── ageMs > 30min   → ⚠ Não confirmado (novo badge âmbar + tooltip)

status="delivered"|"read"|"failed" → comportamento atual, sem alteração
```

## Não está no escopo
- Notificação por toast/email.
- Reenvio automático.
- Coluna nova em `chat_messages`.
- Mudança em `send-chat-message` ou em qualquer webhook.
- Aplicar à API oficial Meta.

Após aprovado, faço a implementação cirúrgica em `ChatMessage.tsx`.
