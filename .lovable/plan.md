

# Anti-Ban Backend Lock — Plano de Implementação

## Resumo

Substituir o delay fixo de 200ms entre mensagens por um sistema de throttling robusto no backend, com intervalos aleatórios de 8-15s e pausas de 2 minutos a cada 15 mensagens por instância. O frontend será atualizado para polling de progresso em tempo real, já que a campanha agora levará muito mais tempo.

## Mudanças

### 1. Edge Function `supabase/functions/send-bulk-whatsapp/index.ts`

**Constantes hardcoded (não parametrizáveis pelo frontend):**
```text
ANTI_BAN_MIN_DELAY_MS = 8000
ANTI_BAN_MAX_DELAY_MS = 15000
BATCH_REST_THRESHOLD = 15        (mensagens por instância)
BATCH_REST_DURATION_MS = 120000  (2 minutos)
MAX_EXECUTION_MS = 380000        (380s, margem para o limite de 400s)
```

**Lógica de delay:**
- Substituir `await new Promise((r) => setTimeout(r, 200))` por `8000 + Math.random() * 7000`
- Manter um contador por instância (`instanceSendCounts: Map<string, number>`)
- A cada 15 envios de uma mesma instância, aplicar pausa de 120s
- Antes de cada pausa longa ou ao atingir ~380s, salvar checkpoint (sent_count, failed_count, progress_metadata com `remaining`, `instance_counts`, `last_chunk_at`)

**Diferenciação de origem (preparação futura):**
- Ler `origin_type` do registro da campanha (já existente ou adicionar campo)
- Se `origin_type === 'AI_AGENT'`, usar delays menores (futuro); para `OP_CARTEIRA` manter os limites rigorosos

**Checkpoint robusto:**
- Após cada mensagem enviada (não apenas por chunk), atualizar `sent_count`/`failed_count` na campanha para que o frontend possa fazer polling
- Ao atingir o timeout de 380s, retornar `{ status: "partial", remaining }` — o frontend re-invoca automaticamente

### 2. Frontend `src/services/whatsappCampaignService.ts`

**Nova função `pollCampaignProgress`:**
- Buscar status da campanha a cada 5s via `supabase.from("whatsapp_campaigns").select(...).eq("id", campaignId)`
- Retorna `{ status, sent_count, failed_count, progress_metadata }`

**Atualizar `startCampaign`:**
- Após invocar a edge function, se o retorno for `partial`, re-invocar automaticamente em loop até `completed`/`failed`/`completed_with_errors`

### 3. Frontend `src/components/carteira/WhatsAppBulkDialog.tsx`

**Step 4 — UX de progresso atualizada:**
- Substituir o spinner genérico por um painel de progresso detalhado:
  - Badge "Modo Anti-Ban Ativo" (verde com ícone de escudo)
  - Barra de progresso com `sent / total` atualizada via polling
  - Texto: "Enviando com intervalos de segurança para proteger suas instâncias..."
  - Contador: "X de Y enviados · Z falhas"
  - Estimativa de tempo: baseada em ~11.5s por mensagem + pausas de lote
- Polling via `useEffect` + `setInterval` a cada 5s enquanto `sending === true`
- Permitir fechar o dialog sem cancelar a campanha (continua em background)

### 4. Novo campo na tabela `whatsapp_campaigns` (migração)

Adicionar coluna `origin_type text default 'OP_CARTEIRA'` para diferenciar disparos de operadores vs IA no futuro.

## Arquivos afetados

| Ação | Arquivo |
|---|---|
| Editar | `supabase/functions/send-bulk-whatsapp/index.ts` |
| Editar | `src/services/whatsappCampaignService.ts` |
| Editar | `src/components/carteira/WhatsAppBulkDialog.tsx` |
| Migração | Adicionar `origin_type` em `whatsapp_campaigns` |

## Impacto operacional

- Uma campanha de 100 destinatários levará ~20-25 minutos (vs ~20s antes)
- O operador pode fechar o dialog e a campanha continua processando no backend
- O sistema se auto-resume via re-invocação quando atinge o timeout da Edge Function

