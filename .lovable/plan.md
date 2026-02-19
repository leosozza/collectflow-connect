
## Finalizar Modulo de SLA de Atendimento no WhatsApp

### Estado Atual

- A coluna `conversations.sla_deadline_at` ja existe no banco
- O webhook (`whatsapp-webhook`) ja calcula o SLA usando `tenants.settings.sla_minutes` (default 30 min) — aplica ao criar/reabrir conversas inbound e limpa ao enviar outbound
- O badge "SLA Expirado" ja existe no ChatPanel com tooltip
- A ConversationList ja mostra icone AlertTriangle quando SLA expirou
- Nao existe campo `sla_hours` na tabela `credores` (o SLA e global pelo tenant)

### O que sera implementado

---

### 1. Coluna `sla_hours` na tabela `credores`

Adicionar coluna para permitir prazo SLA personalizado por credor:

```sql
ALTER TABLE public.credores ADD COLUMN sla_hours NUMERIC DEFAULT NULL;
```

Quando `NULL`, o sistema usa o valor global do tenant (`tenants.settings.sla_minutes`). Quando preenchido, o webhook usara este valor para o calculo.

---

### 2. Campo de configuracao no CredorForm

Na aba **Negociacao** do formulario de credor, adicionar um campo "Prazo SLA de Atendimento (horas)" com:
- Input numerico (aceita decimais, ex: 0.5 = 30 min)
- Texto auxiliar explicando que se vazio, usa o padrao do tenant
- Posicionado apos os campos de juros/multa

---

### 3. Logica no webhook para SLA por credor

Atualizar `whatsapp-webhook/index.ts` para:
- Ao criar/atualizar conversa inbound, verificar se a conversa esta vinculada a um cliente (`client_id`)
- Se vinculada, buscar o credor do cliente e verificar se tem `sla_hours` configurado
- Usar `sla_hours * 60` minutos se disponivel, senao fallback para `tenants.settings.sla_minutes`

---

### 4. Indicador visual aprimorado na ConversationList

Alem do icone vermelho para SLA expirado (ja existe), adicionar:
- Icone amarelo (Clock) para conversas **proximas de expirar** (menos de 25% do tempo restante)
- Tooltip com o tempo restante ou a data/hora do prazo

---

### 5. Edge Function para notificacao de SLA expirado

Criar `supabase/functions/check-sla-expiry/index.ts` que:
- Busca conversas abertas com `sla_deadline_at < now()` que ainda nao tiveram notificacao enviada
- Envia notificacao interna (via `notifications` table) ao operador responsavel (`assigned_to`)
- Titulo: "SLA Expirado" / Mensagem: "A conversa com {nome} excedeu o prazo de atendimento"
- Tipo: `warning`, referencia: `conversation` + conversation_id
- Para evitar notificacoes duplicadas, adiciona coluna `sla_notified_at` na tabela conversations

Esta function sera chamada via cron job (`pg_cron`) a cada 5 minutos.

---

### 6. Coluna de controle `sla_notified_at`

```sql
ALTER TABLE public.conversations ADD COLUMN sla_notified_at TIMESTAMPTZ DEFAULT NULL;
```

Resetada para NULL quando o SLA e recalculado (nova mensagem inbound).

---

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `supabase/migrations/..._sla_module.sql` | Adicionar `sla_hours` em credores e `sla_notified_at` em conversations |
| `src/components/cadastros/CredorForm.tsx` | Adicionar campo "Prazo SLA" na aba Negociacao |
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Adicionar indicador amarelo para SLA proximo de expirar + tooltip |
| `supabase/functions/whatsapp-webhook/index.ts` | Buscar `sla_hours` do credor vinculado ao cliente |
| `supabase/functions/check-sla-expiry/index.ts` | **Nova** — verificar SLAs expirados e enviar notificacoes |
| `supabase/config.toml` | Adicionar `[functions.check-sla-expiry] verify_jwt = false` |

### Resumo

- 2 colunas novas (`credores.sla_hours`, `conversations.sla_notified_at`)
- 1 edge function nova (`check-sla-expiry`)
- 1 cron job (a cada 5 min)
- SLA configuravel por credor com fallback para padrao do tenant
- Indicadores visuais: vermelho (expirado) + amarelo (proximo de expirar)
- Notificacoes automaticas ao operador quando SLA expira
