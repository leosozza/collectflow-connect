

# Plano: Integração Bidirecional com 3CPlus

## Situação atual

A integração é **unidirecional** — RIVO envia comandos para 3CPlus (login, pause, qualify, campaigns) mas nunca recebe callbacks. O sistema usa polling a cada 5 segundos para detectar mudanças de status. Não há registro automático de chamadas — `call_logs` só é preenchido manualmente via `saveCallLog` (busca retroativa).

## O que a bidirecionalidade resolve

- Registro automático de chamadas (início, fim, duração, gravação)
- Atualização instantânea de status do agente (sem delay de polling)
- Captura de qualificações feitas diretamente na 3CPlus
- Dados mais confiáveis para relatórios e timeline do cliente

## Mudanças

### 1. Nova Edge Function: `threecplus-webhook/index.ts`

Endpoint público que recebe POST da 3CPlus com eventos de campanha.

**Eventos tratados:**
- `call.started` — registra início da chamada
- `call.answered` — atualiza status para "em andamento"
- `call.finished` — insere registro completo em `call_logs` (duração, gravação, qualificação)
- `call.qualified` — atualiza `call_logs` com qualificação e cria `call_dispositions` se mapeável
- `agent.status_changed` — atualiza cache de status do agente (opcional)

**Lógica principal:**
- Recebe payload JSON da 3CPlus
- Identifica o tenant pelo `domain` (busca em `tenants.settings` onde `threecplus_domain` = domain do webhook)
- Identifica o cliente pelo telefone (busca em `clients` por phone match)
- Insere/atualiza `call_logs` automaticamente
- Cria `client_events` via o trigger existente `trg_client_event_from_call_log`
- Loga payload completo para debug

**Segurança:** Validação por token secreto no header (configurável por tenant).

### 2. `supabase/config.toml` — Desabilitar JWT para webhook

```toml
[functions.threecplus-webhook]
verify_jwt = false
```

### 3. `supabase/functions/threecplus-proxy/index.ts` — Ação para registrar webhook

Novo action `register_webhook` que chama `POST /campaigns/{id}/webhooks` na API 3CPlus para cadastrar a URL do webhook do RIVO:
```
https://{SUPABASE_URL}/functions/v1/threecplus-webhook
```

Novo action `list_webhooks` para verificar webhooks já cadastrados.

### 4. `src/components/contact-center/threecplus/CampaignsPanel.tsx` — Botão de ativar webhook

Na aba expandida da campanha, adicionar toggle "Webhook ativo" que:
- Verifica se já existe webhook cadastrado para a campanha
- Se não, registra automaticamente via `register_webhook`
- Mostra status (ativo/inativo)

### 5. `src/components/admin/integrations/ThreeCPlusTab.tsx` — Status bidirecional

Adicionar indicador visual mostrando se a integração é unidirecional ou bidirecional (baseado na presença de webhooks ativos).

### 6. Secret para validação

Adicionar secret `THREECPLUS_WEBHOOK_SECRET` para validar que as requisições vêm realmente da 3CPlus.

## Fluxo bidirecional completo

```text
3CPlus dispara chamada
  → call.started → webhook RIVO
    → insere call_logs (status: ringing)
    → trigger cria client_event

Operador atende
  → call.answered → webhook RIVO
    → atualiza call_logs (status: in_progress)

Chamada termina
  → call.finished → webhook RIVO
    → atualiza call_logs (duração, recording_url, status: completed)

Operador qualifica na 3CPlus
  → call.qualified → webhook RIVO
    → atualiza call_logs (qualification)
    → mapeia para call_disposition_types do tenant
    → cria call_dispositions se mapeável
    → trigger cria client_event
```

## Arquivos a criar/editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-webhook/index.ts` | **Novo** — endpoint receptor de webhooks |
| `supabase/config.toml` | Adicionar `[functions.threecplus-webhook] verify_jwt = false` |
| `supabase/functions/threecplus-proxy/index.ts` | Novos actions: `register_webhook`, `list_webhooks`, `delete_webhook` |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Toggle de webhook por campanha |

