

# Plano: Ajustes Finais WhatsApp — 4 Fases

## Fase 1 — Ajuste do SLA

### Problemas encontrados

1. **Percentual baseado em `created_at`** (ChatPanel linha 94): `totalMs = deadlineMs - createdMs` — isso é errado porque o SLA é recalculado a cada inbound, então `created_at` não representa o início do SLA atual.
2. **Mesmo bug na ConversationList** (linha 387): `totalMs = deadlineDate.getTime() - createdAt.getTime()` — mesma lógica incorreta para o ícone amarelo na lista.
3. **Webhook zera SLA em outbound** (linha 261): `updateData.sla_deadline_at = null` — ao responder, o SLA desaparece imediatamente. Isso é comportamentalmente correto (operador respondeu, SLA cumprido), mas conflita com o timer visual que some abruptamente.

### Solução

**Webhook**: manter `sla_deadline_at = null` em outbound — operador respondeu, SLA cumprido. Isso é a regra correta.

**ChatPanel (timer)**: remover cálculo de percentual baseado em `created_at`. Usar faixas absolutas de tempo restante:
- Verde: > 4h restantes
- Amarelo: ≤ 1h restante
- Vermelho: expirado
- Remover estado `slaPercent`, substituir por lógica direta no cálculo do `slaColor`

**ConversationList (ícone SLA)**: mesma correção — substituir cálculo relativo por faixa absoluta de tempo (ícone amarelo quando ≤ 1h, vermelho quando expirado).

### Arquivos
- `src/components/contact-center/whatsapp/ChatPanel.tsx` — remover `slaPercent`, cor por faixa absoluta
- `src/components/contact-center/whatsapp/ConversationList.tsx` — ícone SLA por faixa absoluta

---

## Fase 2 — Ajuste do Reply

### Problemas encontrados

1. **Botão reply em todas as mensagens**: o `ChatMessage.tsx` já mostra reply em inbound E outbound (linhas 96-112). Manter ambos — faz sentido operacional responder qualquer mensagem.
2. **Fallback de preview ausente**: quando `allMessages.find()` não encontra a mensagem original (ex: paginação), o preview simplesmente não aparece.

### Solução

**ChatMessage.tsx**: quando `reply_to_message_id` existe mas a mensagem original não foi encontrada em `allMessages`, mostrar fallback: "Mensagem respondida" em itálico com indicador visual.

### Arquivos
- `src/components/contact-center/whatsapp/ChatMessage.tsx` — fallback no preview de reply

---

## Fase 3 — Revisão do Filtro "Não Lidas"

### Problema atual

"Não lidas" está no `statusFilter` junto com `open/waiting/closed`. Funciona, mas mistura conceitos (status vs leitura).

### Solução

Separar em estado independente `unreadOnly` (boolean). Os pills de status continuam funcionando normalmente. "Não lidas" vira um toggle independente que pode ser combinado com qualquer status.

**ConversationList.tsx**:
- Novo estado `unreadOnly` (boolean, default false)
- Remover `"unread"` do `statusFilter`
- Pill "Não lidas" alterna `unreadOnly` em vez de `setStatusFilter("unread")`
- No filtro: `unreadOnly ? c.unread_count > 0 : true`
- Isso permite combinações como "Aguardando + Não lidas"

### Arquivos
- `src/components/contact-center/whatsapp/ConversationList.tsx` — separar `unreadOnly` de `statusFilter`

---

## Fase 4 — Acabamento Final

Revisão de consistência:
- Verificar que fila `waiting → open` funciona (banner + aceitar + auto-aceitar)
- Verificar que SLA visual está coerente após Fase 1
- Verificar que reply com fallback funciona após Fase 2
- Verificar que filtro combinado funciona após Fase 3
- Sem refatoração grande, apenas ajustes pontuais se necessário

### Arquivos afetados no total

| Arquivo | Fase | Mudança |
|---|---|---|
| `ChatPanel.tsx` | 1 | Remover `slaPercent`, cor SLA por faixa absoluta |
| `ConversationList.tsx` | 1, 3 | Ícone SLA por faixa absoluta + separar `unreadOnly` |
| `ChatMessage.tsx` | 2 | Fallback no preview de reply |

Nenhuma migration. Nenhuma alteração no webhook, serviço, campanhas, automação ou permissões.

