

# Plano: Ajustes Finais WhatsApp Operacional

## 1. SLA — Consolidar regra

**Situação atual**: O webhook zera `sla_deadline_at = null` em outbound (linha 261). O `sendTextMessage` não zera. ChatPanel e ConversationList usam faixas absolutas corretamente.

**Decisão**: "Operador respondeu → SLA cumprido" é a regra correta. O webhook já faz isso. Nenhuma mudança necessária no webhook ou ChatPanel — a lógica já está consistente:
- Inbound → recalcula SLA
- Outbound via webhook → zera SLA (cumprido)
- Timer visual desaparece naturalmente quando `sla_deadline_at` é null
- Badge "SLA Expirado" aparece quando deadline passou

**Nenhuma alteração necessária.** A regra já está consistente entre backend e frontend.

## 2. Auto-aceitar ao enviar mídia/áudio

**Problema**: `handleSendMedia` (WhatsAppChatLayout.tsx linhas 335-338) atualiza apenas `last_message_at`, sem verificar se a conversa está em `waiting`.

**Solução** (`WhatsAppChatLayout.tsx`): No `handleSendMedia`, após o insert da mensagem, incluir a mesma lógica de auto-aceitar: se `selectedConv.status === "waiting"`, adicionar `status: "open"` ao update e atualizar o estado local.

```typescript
// Linha 335-338 — substituir
const updatePayload: any = { last_message_at: new Date().toISOString() };
if (selectedConv.status === "waiting") {
  updatePayload.status = "open";
}
await supabase.from("conversations" as any).update(updatePayload).eq("id", conv.id);

// Atualizar estado local se aceitou
if (selectedConv.status === "waiting") {
  setSelectedConv({ ...selectedConv, status: "open" });
  // Atualizar na lista também
  setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, status: "open" } : c));
}
```

`handleSendAudio` já delega para `handleSendMedia`, então fica coberto automaticamente.

## 3. Reply — manter em todas as mensagens

**Decisão**: Manter reply em inbound e outbound. Operacionalmente faz sentido (operador pode querer referenciar sua própria mensagem anterior ou a do cliente). O código já está implementado assim. **Nenhuma alteração.**

## 4. Fallback do preview do reply

**Situação atual**: ChatMessage.tsx já tem fallback `"Mensagem respondida"` (linha 152) quando a mensagem original não é encontrada em `allMessages`. **Já implementado. Nenhuma alteração.**

## 5. Filtro "Não lidas" — já está separado

**Situação atual**: ConversationList.tsx já usa `unreadOnly` como estado independente (linha 165), separado de `statusFilter`. O filtro combina ambos (linha 197). **Já implementado corretamente. Nenhuma alteração.**

## Resumo

| Item | Ação |
|---|---|
| SLA (regra consistente) | Nenhuma — já está correto |
| Auto-aceitar mídia/áudio | **Corrigir** `handleSendMedia` em `WhatsAppChatLayout.tsx` |
| Reply (decisão) | Nenhuma — manter em todas as mensagens |
| Fallback reply | Nenhuma — já implementado |
| Filtro "Não lidas" | Nenhuma — já separado |

**Único arquivo a alterar**: `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — adicionar auto-aceitar (`waiting` → `open`) ao enviar mídia.

