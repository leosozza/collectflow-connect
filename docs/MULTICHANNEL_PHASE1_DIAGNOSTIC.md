# FASE 1 — Relatório de Diagnóstico da Arquitetura Multicanal

## Visão Geral da Arquitetura Atual

O sistema opera com 3 providers de WhatsApp (Evolution/Baylers, WuzAPI, Gupshup) através de uma arquitetura parcialmente abstraída. Existe um motor de envio compartilhado (`whatsapp-sender.ts`) mas a ingestão de mensagens e o atendimento manual estão fortemente acoplados ao provider Evolution.

---

## 1. INVENTÁRIO DE ACOPLAMENTOS

### 1.1 Atendimento Manual → Hardcoded para Evolution

| Local | Acoplamento |
|---|---|
| `conversationService.ts` linhas 169-185 | `sendTextMessage()` chama diretamente `evolution-proxy?action=sendMessage` |
| `WhatsAppChatLayout.tsx` linhas 372-384 | Envio de mídia chama diretamente `evolution-proxy?action=sendMessage` |
| `whatsappInstanceService.ts` | Gestão de instância exclusivamente Evolution |

### 1.2 Webhook de Entrada → Hardcoded para Evolution

| Local | Acoplamento |
|---|---|
| `whatsapp-webhook/index.ts` | Parseia exclusivamente payload Evolution |
| `gupshup-webhook/index.ts` | Só atualiza `message_logs` — NÃO alimenta inbox |

### 1.3 Lookup de Cliente por Telefone → Espalhado e Ineficiente

| Local | Método |
|---|---|
| `whatsapp-webhook/index.ts` | `ilike.%suffix%` em `clients.phone/phone2/phone3` (10 dígitos) |
| `useClientByPhone.ts` | `ilike.%suffix%` em `clients.phone/phone2/phone3` (8 dígitos) |
| `send-bulk-whatsapp/index.ts` | Usa `client_id` direto |

### 1.4 Conversas → Sem Unicidade Real

- Sem constraint UNIQUE em `(tenant_id, instance_id, remote_phone)`
- Deduplicação apenas por query
- Múltiplos pontos de criação (webhook, bulk, frontend)

### 1.5 Mensagens → Deduplicação Frágil

- `chat_messages.external_id` sem UNIQUE
- Race condition entre webhooks concorrentes
- `message_logs` vs `chat_messages` = duas fontes de verdade

### 1.6 Round-Robin → COUNT dinâmico a cada nova conversa

### 1.7 Inbox → Sem denormalização (busca última msg por batch)

---

## 2. O QUE FUNCIONA BEM (MANTER)

- `whatsapp-sender.ts` — motor de envio multi-provider
- `template-resolver.ts` — resolução de variáveis
- `message-logger.ts` — logger centralizado
- `whatsapp_instances` — modelo com `provider`, `provider_category`
- `client_phones` — tabela existente (subutilizada)
- `operator_instances` — vínculo operador-instância
- Realtime, SLA, fila waiting→open

---

## 3. PRIORIDADES DE REFATORAÇÃO

| Prioridade | Item |
|---|---|
| **Crítico** | Atendimento manual usa só Evolution |
| **Crítico** | Gupshup webhook não alimenta inbox |
| **Crítico** | Sem unicidade em conversas |
| **Alto** | Lookup sem `client_phones` |
| **Alto** | Dedup sem constraint |
| **Alto** | Inbox sem denormalização |
| **Médio** | Round-robin por COUNT |
| **Médio** | Lógica espalhada no webhook |

---

## 4. DEPENDÊNCIAS ENTRE FASES

```
FASE 2 (Identidade Telefone)
  └─> FASE 3 (Core Conversa/Mensagem)
       └─> FASE 4 (RPC Ingestão)
            └─> FASE 5 (Providers)
                 └─> FASE 6 (Meta API)
                      └─> FASE 7 (Roteamento)
FASE 8 (Inbox Server-side) — após FASE 3
FASE 9 (Filas/Workload) — após FASE 4
FASE 10 (Campanhas) — após FASE 5
FASE 11 (IA/Voz) — após FASE 4 + 7
FASE 12 (Observabilidade) — final
```

---

## 5. RISCOS E MITIGAÇÕES

| Risco | Mitigação |
|---|---|
| Quebrar envio manual | Manter `evolution-proxy` como fallback |
| Duplicatas ao criar UNIQUE | Limpar antes da constraint |
| `client_phones` vazia | Migrar dados de `clients.phone/phone2/phone3` |
| Gupshup sem dados legados | Apenas ativar fluxo novo |

---

**Status**: ✅ Concluída
**Próxima fase**: FASE 2 — Identidade de Contato e Telefone
