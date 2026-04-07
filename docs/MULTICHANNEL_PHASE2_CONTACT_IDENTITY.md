# FASE 2 — Identidade de Contato e Telefone como Camada Oficial

**Status**: ✅ Concluída

## O Que Foi Feito

### 1. Schema — Colunas normalizadas em `client_phones`

Adicionadas colunas:
- `phone_e164` — formato internacional 13 dígitos (ex: `5511999887766`)
- `phone_last8` — últimos 8 dígitos para fallback
- `phone_last10` — últimos 10 dígitos
- `client_id` — FK para `clients.id` (link direto)

### 2. Índices

- `idx_client_phones_tenant_e164` — lookup exato por e164
- `idx_client_phones_tenant_last8` — fallback por sufixo
- `idx_client_phones_client_id` — join reverso

### 3. Função `normalize_phone_br(text)`

Normaliza telefones brasileiros para 13 dígitos (55 + DDD + 9 dígitos):
- 10 dígitos (DDD+8) → insere 9° dígito + prefixo 55
- 11 dígitos (DDD+9) → prefixo 55
- 12 dígitos (55+DDD+8) → insere 9° dígito
- 13 dígitos (55+DDD+9) → mantém

### 4. Migração de Dados

- **86.263 registros** migrados de `clients.phone/phone2/phone3`
- Normalização automática para e164/last8/last10
- Priority: phone=1, phone2=2, phone3=3
- ON CONFLICT DO NOTHING (respeita UNIQUE existente)

### 5. RPC `resolve_client_by_phone(tenant_id, phone)`

- Match exato por `phone_e164` (usa índice)
- Fallback por `phone_last8` se não encontrar
- Ordenado por `priority ASC`
- SECURITY DEFINER com search_path fixo

### 6. Trigger `trg_sync_client_phones`

- Dispara em INSERT/UPDATE de phone, phone2, phone3 em `clients`
- Sincroniza automaticamente para `client_phones`
- UPSERT com ON CONFLICT (atualiza se já existe)

### 7. Webhooks de Enriquecimento Atualizados

- `targetdata-webhook/index.ts` — preenche phone_e164, phone_last8, phone_last10
- `targetdata-enrich/index.ts` — preenche phone_e164, phone_last8, phone_last10

## Sem Alteração

- Lookup antigo (`useClientByPhone.ts`, `whatsapp-webhook`) permanece intacto
- Será substituído na Fase 4 (RPC de ingestão)
- Zero impacto na operação atual

## Resultado

| Métrica | Valor |
|---|---|
| Registros migrados | 86.263 |
| Índices criados | 3 |
| RPCs criadas | 2 (`normalize_phone_br`, `resolve_client_by_phone`) |
| Trigger criado | 1 (`trg_sync_client_phones`) |
| Código alterado | 2 edge functions |
| Breaking changes | 0 |

## Próxima Fase

**FASE 3 — Core Canônico de Conversa e Mensagem**
- Revisar `conversations` e `chat_messages`
- Adicionar campos para multiprovider (channel_type, provider, endpoint_id)
- Constraint UNIQUE para idempotência
- Denormalização de última mensagem
