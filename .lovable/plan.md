

# Score Operacional V1 — Substituir lógica do `propensity_score`

## Resumo

Substituir integralmente a lógica do `calculate-propensity` por um motor operacional baseado em 4 dimensões (Contato, Engajamento, Conversão, Credibilidade), mantendo `propensity_score` como único score oficial. Adicionar 4 campos auxiliares na tabela `clients` e criar uma tabela `client_events` como timeline unificada.

---

## O que NÃO muda

- Campo `propensity_score` na tabela `clients` — continua existindo, mesmo nome, mesmo tipo (integer 0-100)
- `PropensityBadge` — continua renderizando o mesmo campo (atualizar apenas o tooltip text)
- `CarteiraPage`, `CarteiraTable`, `CarteiraKanban` — zero alteração funcional
- `workflow-engine` condition_score — continua lendo `propensity_score`
- Filtros, ordenações, export Excel — sem alteração

---

## Mudanças no banco de dados (2 migrations)

### Migration 1 — Campos auxiliares em `clients`

```sql
ALTER TABLE public.clients
  ADD COLUMN preferred_channel text DEFAULT 'unknown',
  ADD COLUMN suggested_queue text DEFAULT 'low_history',
  ADD COLUMN score_reason text,
  ADD COLUMN score_confidence text DEFAULT 'low',
  ADD COLUMN score_updated_at timestamptz;
```

Campos internos para tornar o score acionável. Não criam segundo score.

### Migration 2 — Tabela `client_events`

```sql
CREATE TABLE public.client_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_cpf text NOT NULL,
  event_type text NOT NULL,       -- 'disposition', 'call', 'whatsapp_inbound', 'whatsapp_outbound', 'agreement_created', 'agreement_signed', 'agreement_cancelled', 'message_sent', 'callback_scheduled'
  event_source text NOT NULL,     -- 'operator', 'system', 'prevention', 'integration'
  event_channel text,             -- 'call', 'whatsapp', 'sms', 'email', null
  event_value text,               -- ex: 'cpc', 'no_answer', 'approved', 'cancelled'
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;
-- RLS: tenant isolation
CREATE POLICY "tenant_view" ON public.client_events FOR SELECT TO authenticated
  USING (tenant_id = (SELECT get_my_tenant_id()));
CREATE POLICY "tenant_insert" ON public.client_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT get_my_tenant_id()));

CREATE INDEX idx_client_events_cpf ON public.client_events (tenant_id, client_cpf, created_at DESC);
CREATE INDEX idx_client_events_client ON public.client_events (client_id, created_at DESC);
```

---

## Edge Function — Reescrever `calculate-propensity/index.ts`

Substituir **integralmente** a lógica atual. Nova lógica:

### Fluxo
1. Recebe `{ cpf?: string }` (individual) ou `{}` (batch todo tenant)
2. Para cada CPF, busca eventos de `client_events` (últimos 90 dias)
3. Calcula 4 sub-scores com peso de recência (7d=100%, 8-30d=70%, >30d=40%)
4. Aplica pesos: Contato (25%) + Engajamento (20%) + Conversão (35%) + Credibilidade (20%)
   - Mapeamento para fontes: operador=45%, sistema=35%, prevenção=20% (aplicado dentro de cada dimensão)
5. Gera metadados: `preferred_channel`, `suggested_queue`, `score_reason`, `score_confidence`
6. Atualiza `clients.propensity_score` + campos auxiliares

### Lógica das 4 dimensões (puro heurístico, sem IA)

**CONTATO (25%)**
- CPC / chamada atendida / resposta WhatsApp inbound → +pontos
- Não atende / caixa postal / pessoa errada → -pontos
- Ratio: eventos positivos de contato / total de tentativas

**ENGAJAMENTO (20%)**
- Callback agendado → +pontos
- Resposta recorrente WhatsApp → +pontos
- Muitas mensagens sem resposta → -pontos

**CONVERSÃO (35%)**
- Acordo criado → +pontos
- Acordo aprovado/assinado → ++pontos
- Muitas interações sem acordo → -pontos

**CREDIBILIDADE (20%)**
- 1º acordo formalizado = forte positivo
- 1ª quebra = -leve
- 2ª quebra = -moderado
- 3+ quebras = -forte
- Nunca formalizou < já formalizou e quebrou

### Score base para clientes sem histórico = 50, confidence = "low", queue = "low_history"

---

## Populador de `client_events` (one-time backfill + ongoing)

### Edge function auxiliar: `backfill-client-events`
Percorre dados existentes em `call_dispositions`, `call_logs`, `chat_messages`, `agreements`, `agreement_signatures`, `message_logs` e insere em `client_events`. Executar uma vez.

### Triggers no banco (para ongoing)
Criar triggers `AFTER INSERT` nas tabelas fonte para auto-inserir em `client_events`:
- `call_dispositions` → event_type='disposition', source='operator', channel='call'
- `call_logs` → event_type='call', source='system', channel='call'
- `chat_messages` → event_type='whatsapp_inbound/outbound', source='operator'/'system', channel='whatsapp'
- `agreements` (INSERT/UPDATE status) → event_type='agreement_created/cancelled/etc', source='operator'
- `agreement_signatures` → event_type='agreement_signed', source='operator'
- `message_logs` → event_type='message_sent', source='prevention'

---

## UI — Atualizações mínimas

### `PropensityBadge.tsx`
- Tooltip: mudar de "propensão a pagamento" → "Score Operacional"
- Adicionar tooltip com `score_reason` quando disponível (prop opcional)

### `CarteiraPage.tsx`
- Nenhuma mudança funcional. O botão "Calcular Score" continua chamando `calculate-propensity`.

### `CarteiraTable.tsx` / `CarteiraKanban.tsx`
- Zero alteração (já leem `propensity_score`)

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_score_v1_columns.sql` | Criar — ADD COLUMN nos clients |
| `supabase/migrations/xxx_client_events.sql` | Criar — tabela + RLS + triggers |
| `supabase/functions/calculate-propensity/index.ts` | Reescrever — nova lógica V1 |
| `supabase/functions/backfill-client-events/index.ts` | Criar — populador one-time |
| `src/components/carteira/PropensityBadge.tsx` | Pequena atualização tooltip |
| `docs/SCORE_V1_ROADMAP.md` | Criar — roadmap de evolução |

---

## Roadmap documentado (entregável 2)

Será criado em `docs/SCORE_V1_ROADMAP.md` com as 4 fases detalhadas:

- **Fase 1** (esta implementação): Motor V1 heurístico, client_events, metadados, recálculo
- **Fase 2**: Vinculação automática WhatsApp↔cliente, contadores materializados, promessas estruturadas
- **Fase 3**: Speech-to-text 3CPlus, análise IA de chamadas e WhatsApp
- **Fase 4**: IA complementar no score, ajuste por credor, dashboards operacionais, explicabilidade ampliada

---

## Detalhes técnicos

- **Recálculo automático**: Os triggers de `client_events` podem disparar recálculo via `pg_net` (HTTP async para a edge function) ou via cron batch (mais seguro na V1). Recomendação: cron a cada 15min + recálculo individual sob demanda.
- **Backfill**: Edge function separada, executada uma vez pelo admin. Processa em batches de 500 eventos.
- **Sem IA na V1**: Motor 100% heurístico, determinístico, auditável. Arquitetura preparada para IA futura (basta adicionar 5ª dimensão com peso).
- **Importação**: Clientes importados entram com score=50, confidence=low, queue=low_history (via DEFAULT no banco).

