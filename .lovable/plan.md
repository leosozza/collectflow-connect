

# FASE 1 — Relatório de Diagnóstico da Arquitetura Multicanal

## Visão Geral da Arquitetura Atual

O sistema opera com 3 providers de WhatsApp (Evolution/Baylers, WuzAPI, Gupshup) através de uma arquitetura parcialmente abstraída. Existe um motor de envio compartilhado (`whatsapp-sender.ts`) mas a ingestão de mensagens e o atendimento manual estão fortemente acoplados ao provider Evolution.

---

## 1. INVENTÁRIO DE ACOPLAMENTOS

### 1.1 Atendimento Manual → Hardcoded para Evolution

| Local | Acoplamento |
|---|---|
| `conversationService.ts` linhas 169-185 | `sendTextMessage()` chama diretamente `evolution-proxy?action=sendMessage` — ignora WuzAPI e Gupshup |
| `WhatsAppChatLayout.tsx` linhas 372-384 | Envio de mídia chama diretamente `evolution-proxy?action=sendMessage` — ignora WuzAPI e Gupshup |
| `whatsappInstanceService.ts` | Todas as funções de gestão de instância (create, connect, status, delete, webhook) são exclusivamente Evolution |

**Impacto**: Operadores de tenants com WuzAPI ou Gupshup não conseguem enviar mensagens pelo chat manual. Apenas campanhas e workflows usam o motor unificado.

### 1.2 Webhook de Entrada → Hardcoded para Evolution

| Local | Acoplamento |
|---|---|
| `whatsapp-webhook/index.ts` | Parseia exclusivamente payload Evolution (`messages.upsert`, `messages.update`, `connection.update`) |
| `gupshup-webhook/index.ts` | Só atualiza `message_logs` — NÃO cria conversas nem chat_messages para o CRM |

**Impacto**: Mensagens inbound via Gupshup oficial não aparecem na inbox. O Gupshup só funciona para campanhas outbound (unidirecional).

### 1.3 Lookup de Cliente por Telefone → Espalhado e Ineficiente

| Local | Método |
|---|---|
| `whatsapp-webhook/index.ts` linhas 48-76 | `ilike.%${suffix}%` em `clients.phone/phone2/phone3` com suffix de 10 dígitos |
| `useClientByPhone.ts` | `ilike.%${suffix}%` em `clients.phone/phone2/phone3` com suffix de 8 dígitos |
| `send-bulk-whatsapp/index.ts` | Usa `client_id` direto (sem lookup) |

**Impacto**: Três implementações diferentes. Nenhuma usa `client_phones`. `ILIKE %suffix%` faz full table scan (sem índice). Risco de falso positivo em tenants com muitos registros.

### 1.4 Conversas → Sem Unicidade Real

| Problema | Detalhe |
|---|---|
| Sem constraint UNIQUE | `conversations` não tem constraint em `(tenant_id, instance_id, remote_phone)` — deduplicação é apenas por query |
| `send-bulk-whatsapp` cria conversas | `ensureConversationAndMessage()` busca sem `instance_id` quando é `null` — pode criar duplicatas |
| Webhook cria conversas | `whatsapp-webhook` busca por `(tenant_id, instance_id, remote_phone)` |
| Frontend pode criar | Deep linking `?phone=` no chat pode criar conversas |

**Impacto**: Conversas duplicadas possíveis. Sem garantia de idempotência.

### 1.5 Mensagens → Deduplicação Frágil

| Problema | Detalhe |
|---|---|
| `chat_messages.external_id` sem UNIQUE | Dedup é por query SELECT antes do INSERT — race condition entre webhooks concorrentes |
| `message_logs` é tabela separada | Campanhas gravam em `message_logs` E `chat_messages` — duas fontes de verdade |

### 1.6 Round-Robin → Contagem Dinâmica Pesada

O webhook faz COUNT em `conversations` a cada nova conversa inbound para decidir atribuição. Isso não escala para operações com dezenas de operadores e centenas de conversas.

### 1.7 Inbox Frontend → Sem Denormalização

| Problema | Detalhe |
|---|---|
| `fetchConversations()` | Faz query extra para buscar última mensagem de TODAS as conversas visíveis (batch de até 50 IDs em `chat_messages`) |
| Sem `last_message_content` na tabela | A conversa não tem preview denormalizado — sempre depende de join |
| Filtros client-side | Tags, operador e busca por nome dependem de filtragem no frontend |

---

## 2. O QUE FUNCIONA BEM (MANTER)

| Componente | Avaliação |
|---|---|
| `whatsapp-sender.ts` | Motor de envio multi-provider funcional (Evolution, WuzAPI, Gupshup). Reutilizável. |
| `template-resolver.ts` | Resolução de variáveis de template unificada. |
| `message-logger.ts` | Logger centralizado com metadata de rastreabilidade. |
| `whatsapp_instances` | Modelo de instância com `provider`, `provider_category`, capabilities. Boa base. |
| `client_phones` | Tabela já existe com `is_whatsapp`, `priority`, `source`. Subutilizada. |
| `operator_instances` | Vínculo operador-instância. Funcional para round-robin. |
| Realtime | Subscription em `chat_messages` e `conversations` funciona. |
| SLA | Timer com lookup por credor → tenant. Correto. |
| Fila waiting→open | Fluxo de auto-aceite ao responder. Correto. |

---

## 3. O QUE PRECISA SER REFATORADO

| Prioridade | Item | Motivo |
|---|---|---|
| **Crítico** | Atendimento manual usa só Evolution | Tenants com WuzAPI/Gupshup não operam no chat |
| **Crítico** | Gupshup webhook não alimenta inbox | Mensagens oficiais inbound são invisíveis no CRM |
| **Crítico** | Sem unicidade em conversas | Duplicatas estruturais possíveis |
| **Alto** | Lookup de telefone sem `client_phones` | Performance ruim, inconsistência entre fluxos |
| **Alto** | Dedup de mensagens sem constraint | Race condition em webhooks concorrentes |
| **Alto** | Inbox sem denormalização | Performance degradada com volume |
| **Médio** | Round-robin por COUNT dinâmico | Não escala |
| **Médio** | Lógica de ingestão espalhada no webhook | Difícil adicionar novo provider |
| **Baixo** | `message_logs` vs `chat_messages` separados | Duas fontes de verdade para mensagens |

---

## 4. O QUE SERÁ SUBSTITUÍDO

| Item | Substituto |
|---|---|
| Chamada direta a `evolution-proxy` no `conversationService` | Motor de envio unificado que consulta o provider da instância |
| `gupshup-webhook` atual (só atualiza `message_logs`) | Webhook canônico que alimenta `conversations` + `chat_messages` |
| `findClientByPhone` no webhook (ilike em clients) | Função de lookup via `client_phones` com índice |
| Dedup por query SELECT | Constraint UNIQUE em `chat_messages(tenant_id, external_id)` |
| Busca de última mensagem em `fetchConversations` | Colunas denormalizadas em `conversations` |

---

## 5. RISCOS DA MIGRAÇÃO

| Risco | Mitigação |
|---|---|
| Quebrar envio manual durante refatoração | Manter `evolution-proxy` como fallback até novo motor estar validado |
| Conversas duplicadas ao adicionar constraint | Limpar duplicatas antes de criar UNIQUE |
| `client_phones` vazia para tenants existentes | Migração de dados de `clients.phone/phone2/phone3` antes de trocar lookup |
| Gupshup inbound nunca teve conversas | Não há dados legados para migrar — apenas ativar o fluxo |
| Performance da inbox com denormalização | Manter query atual como fallback enquanto popula colunas novas |

---

## 6. DEPENDÊNCIAS ENTRE FASES

```text
FASE 2 (Identidade Telefone)
  └─> FASE 3 (Core Conversa/Mensagem) — depende de lookup por client_phones
       └─> FASE 4 (RPC Ingestão) — depende do modelo canônico
            └─> FASE 5 (Providers) — depende da RPC para registrar
                 └─> FASE 6 (Meta API) — é um provider adapter novo
                      └─> FASE 7 (Roteamento) — depende de providers abstraídos
FASE 8 (Inbox Server-side) — independente, pode rodar após FASE 3
FASE 9 (Filas/Workload) — depende de FASE 4
FASE 10 (Campanhas) — depende de FASE 5
FASE 11 (IA/Voz) — depende de FASE 4 + 7
FASE 12 (Observabilidade) — final
```

---

## 7. RECOMENDAÇÃO PARA FASE 2

Começar pela tabela `client_phones`:
1. Adicionar colunas normalizadas (`phone_e164`, `phone_last8`, `phone_last10`)
2. Criar migração para popular a partir de `clients.phone/phone2/phone3`
3. Criar índices em `(tenant_id, phone_e164)` e `(tenant_id, phone_last8)`
4. Criar função RPC `resolve_client_by_phone(tenant_id, phone)` com match exato + fallback por sufixo
5. Não desligar o lookup antigo ainda — apenas preparar o novo

Nenhum código será alterado nesta fase. Este relatório é o entregável da Fase 1.

