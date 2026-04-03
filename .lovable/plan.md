

# Plano: Ajustes Finais WhatsApp Operacional

## Análise do Estado Atual

1. **SLA**: Webhook zera `sla_deadline_at = null` em outbound (linha 261). Frontend usa faixas absolutas. A regra "operador respondeu → SLA cumprido" já está implementada e é consistente. **Nenhuma alteração necessária** — o comportamento é coerente: inbound recalcula SLA, outbound (operador respondeu) zera. O timer some naturalmente quando `sla_deadline_at` é null.

2. **Auto-aceitar mídia/áudio**: Já implementado em `WhatsAppChatLayout.tsx` linhas 335-348 — `handleSendMedia` já verifica `selectedConv.status === "waiting"` e atualiza para `"open"`. `handleSendAudio` delega para `handleSendMedia`. **Já está correto.**

3. **Reply em outbound**: `ChatMessage.tsx` linhas 107-123 mostram botão de reply tanto em inbound (linha 107) quanto em outbound (linha 117). **Este é o único ponto a corrigir.**

## Única Alteração Necessária

**Arquivo**: `src/components/contact-center/whatsapp/ChatMessage.tsx`

Remover o bloco de reply para mensagens outbound (linhas 116-123). Manter apenas o reply para mensagens inbound (linhas 106-115).

Preservar todo o resto: preview no input, persistência de `reply_to_message_id`, renderização na bolha, fallback "Mensagem respondida".

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `ChatMessage.tsx` | Remover botão reply de mensagens outbound |

Nenhuma alteração em: webhook, SLA, campanhas, automação, permissões, disparo da carteira.

