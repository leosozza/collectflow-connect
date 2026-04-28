# Edge Functions — Documentação Completa

> **Projeto**: RIVO Connect  
> **Total**: 34 Edge Functions  
> **Runtime**: Deno (Supabase Edge Functions)  
> **Última atualização**: Março 2026

---

## Índice

1. [Visão Geral](#visão-geral)
2. [🔌 Proxies de Integrações](#-proxies-de-integrações)
3. [📥 Webhooks](#-webhooks)
4. [⚙️ Automações e Agendamentos](#️-automações-e-agendamentos)
5. [🔄 Workflows](#-workflows)
6. [🧠 Inteligência Artificial](#-inteligência-artificial)
7. [👤 Usuários e Auth](#-usuários-e-auth)
8. [🪙 Tokens e Pagamentos](#-tokens-e-pagamentos)
9. [🌐 Portal do Devedor](#-portal-do-devedor)
10. [📱 WhatsApp](#-whatsapp)
11. [📊 Relatórios e Notificações](#-relatórios-e-notificações)
12. [📦 API Pública](#-api-pública)
13. [🔐 Referência de Secrets](#-referência-de-secrets)

---

## Visão Geral

### Padrões Comuns

Todas as Edge Functions seguem estes padrões:

```typescript
// 1. CORS Headers — presente em todas as funções
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 2. Preflight OPTIONS — sempre tratado
if (req.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}

// 3. Supabase Admin Client — para operações privilegiadas
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
```

### Categorias

| Categoria | Quantidade | Descrição |
|-----------|------------|-----------|
| Proxies | 7 | Intermediam chamadas a APIs externas |
| Webhooks | 5 | Recebem callbacks de serviços externos |
| Automações | 4 | Jobs agendados de manutenção de dados |
| Workflows | 4 | Motor de fluxos visuais e triggers |
| IA | 2 | Sugestões e scoring com IA |
| Auth/Usuários | 2 | Criação de usuários e convites |
| Tokens | 2 | Compra e consumo de tokens |
| Portal | 2 | Lookup e checkout do portal do devedor |
| WhatsApp | 2 | Envio em massa e webhook de mensagens |
| Relatórios | 2 | Envio de relatórios e execução de régua |
| API Pública | 1 | API REST completa para integrações |

---

## 🔌 Proxies de Integrações

### `asaas-proxy`

**Descrição**: Proxy para a API de pagamentos Asaas. Suporta ambientes sandbox e produção.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `ASAAS_API_KEY_SANDBOX`, `ASAAS_API_KEY_PRODUCTION`, `SUPABASE_ANON_KEY` |

**Ações disponíveis** (campo `action` no body):
- `create_customer` — Cria cliente no Asaas (nome, email, CPF, telefone)
- `create_payment` — Cria cobrança (Boleto, Cartão, PIX)
- `get_payment` — Consulta status de pagamento por ID
- `get_pix_qrcode` — Obtém QR Code PIX de um pagamento

**Fluxo**:
1. Valida JWT do usuário
2. Busca configuração de ambiente (sandbox/produção) em `system_settings`
3. Seleciona API key e base URL correspondente
4. Encaminha requisição para a API Asaas
5. Retorna resposta da API

---

### `asaas-platform-proxy`

**Descrição**: Proxy Super Admin para a conta Asaas da plataforma, usada para cobrar mensalidades dos tenants.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT de Super Admin) |
| **Secrets** | `ASAAS_PLATFORM_API_KEY_SANDBOX`, `ASAAS_PLATFORM_API_KEY_PRODUCTION`, `SUPABASE_ANON_KEY` |

**Ações disponíveis**:
- `ping` — Valida a credencial ativa da plataforma
- `create_customer` — Cria cliente na conta Asaas da plataforma
- `create_payment` — Cria cobrança avulsa
- `create_subscription` — Cria assinatura Asaas
- `create_tenant_subscription` — Cria/atualiza cliente Asaas do tenant, gera assinatura e salva o vínculo em `platform_billing_subscriptions`
- `get_subscription_payments` — Lista cobranças geradas por uma assinatura

---

### `cobcloud-proxy`

**Descrição**: Proxy completo para a API CobCloud v3 — gestão de títulos, devedores e baixas.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário, requer role admin) |
| **Secrets** | `SUPABASE_ANON_KEY` |
| **Credenciais** | Armazenadas em `tenants.settings` (cobcloud_token_company, cobcloud_token_client) |

**Ações disponíveis** (campo `action` no body):
- `status` — Testa conexão e retorna contagem de devedores/títulos
- `import-titulos` — Importa títulos da CobCloud para tabela `clients` com validação via Zod
- `export-devedores` — Exporta clientes selecionados para a CobCloud
- `baixar-titulo` — Dá baixa em título na CobCloud
- `import-all` — Importação completa paginada (auto-detecta endpoint)
- `send-boleto` — Envia boleto para devedor
- `list-boletos` — Lista boletos de um devedor
- `cancel-titulo` — Cancela título

**Destaques técnicos**:
- Validação de input com schemas Zod
- Auto-detecção de endpoint (titulos vs devedores)
- Retry com backoff para rate limiting (429)
- Sanitização de strings e CPF

---

### `evolution-proxy`

**Descrição**: Proxy para Evolution API (WhatsApp Business via Baileys). Gerencia instâncias, conexão e envio de mensagens.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `SUPABASE_ANON_KEY` |

**Ações disponíveis** (query param `action`):
- `create` — Cria instância WhatsApp (com auto-recovery de nome duplicado)
- `connect` — Conecta instância e obtém QR Code (com logout prévio e polling)
- `restart` — Reinicia instância (logout + reconnect)
- `status` — Consulta estado de conexão da instância
- `delete` — Remove instância (logout graceful + delete)
- `sendMessage` — Envia mensagem de texto ou mídia
- `setWebhook` — Configura URL de webhook para eventos

**Destaques técnicos**:
- Auto-recovery: se instância já existe no remoto, deleta e recria
- Polling de QR Code com até 6 tentativas (interval 2s)
- Trata 404 como "instância deletada remotamente"

---

### `negociarie-proxy`

**Descrição**: Proxy para API Negociarie v2 — emissão de cobranças, boletos, PIX, cartão e inadimplência.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `NEGOCIARIE_CLIENT_ID`, `NEGOCIARIE_CLIENT_SECRET`, `SUPABASE_ANON_KEY` |

**Ações disponíveis** (campo `action` no body):
- `test-connection` — Testa autenticação OAuth2
- `nova-cobranca` — Cria nova cobrança (boleto)
- `nova-pix` — Cria cobrança PIX
- `nova-cartao` — Cria cobrança via cartão
- `consulta-cobrancas` — Consulta cobranças por CPF ou ID
- `baixa-manual` — Dá baixa manual em cobrança
- `parcelas-pagas` — Lista parcelas pagas por data
- `alteradas-hoje` — Lista cobranças alteradas hoje
- `atualizar-callback` — Registra URL de callback
- `pagamento-credito` — Processa pagamento via crédito
- `cancelar-pagamento` — Cancela pagamento via crédito
- `inadimplencia-nova` — Registra nova inadimplência
- `inadimplencia-titulos` — Consulta títulos de inadimplência
- `inadimplencia-acordos` — Consulta acordos de inadimplência
- `inadimplencia-baixa-parcela` — Dá baixa em parcela de inadimplência
- `inadimplencia-devolucao` — Devolução de título

**Destaques técnicos**:
- Cache de token OAuth2 em memória (50 min TTL)
- Reset automático do token em erros 401
- Detecção de resposta HTML (servidor indisponível)

---

### `threecplus-proxy`

**Descrição**: Proxy completo para a API 3CPlus — discador preditivo, campanhas, agentes, relatórios e gerenciamento.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma (credenciais 3CPlus passadas no body: `domain`, `api_token`) |
| **Secrets** | Nenhum (credenciais por tenant) |

**Ações disponíveis** (campo `action` no body) — **~50 ações**:

*Campanhas*: `list_campaigns`, `get_campaign_lists`, `create_list`, `send_mailing`, `create_campaign`, `update_campaign`, `pause_campaign`, `resume_campaign`, `campaign_statistics`, `campaign_graphic_metrics`, `campaign_calls`, `campaign_agents_status`

*Agentes*: `agents_online`, `agents_status`, `logout_agent`, `list_active_agents`, `agents_report`, `spy_agent`

*Chamadas*: `company_calls`, `calls_report`, `get_recording`

*Qualificações*: `list_qualifications`, `create_qualification`, `update_qualification`, `delete_qualification`

*Block List*: `list_block_list`, `add_block_list`, `remove_block_list`

*Equipes*: `list_teams`, `get_team`, `create_team`, `update_team`

*Agendamentos*: `list_schedules`

*SMS*: `list_sms_mailings`, `create_sms_mailing`, `start_sms_mailing`, `upload_sms_mailing`

*Usuários*: `list_users`, `create_user`, `update_user`, `deactivate_user`

*Filas Receptivas*: `list_receptive_queues`, `create_receptive_queue`, `list_receptive_ivr`, `list_receptive_numbers`

*Rotas*: `list_routes`, `update_routes`, `route_hangup_report`

*Horários*: `list_office_hours`, `get_office_hours`, `create_office_hours`, `update_office_hours`, `delete_office_hours`

*Intervalos*: `list_work_break_intervals`, `create_work_break_interval`, `update_work_break_interval`, `delete_work_break_interval`

*Scripts*: `list_scripts`, `get_script`, `create_script`, `update_script`, `delete_script`

---

### `maxsystem-proxy`

**Descrição**: Proxy para API MaxSystem — consulta de parcelas, agências e modelos de cobrança.

| Item | Valor |
|------|-------|
| **Método HTTP** | GET/POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `SUPABASE_ANON_KEY` |
| **Restrição** | Apenas tenants com slug `maxfama` ou `temis` |

**Ações disponíveis** (query param `action`):
- `installments` (default) — Consulta parcelas com filtros OData
- `agencies` — Lista agências
- `model-search` — Busca modelo por número de contrato
- `model-details` — Detalhes de um modelo (endereço, email, nome)
- `model-names` — Busca batch de nomes de modelo por contratos (POST)

**Destaques técnicos**:
- Mapa de códigos de estado para UF (1=AC, 26=SP, etc.)
- Batch de 10 em paralelo para `model-names`

---

### `wuzapi-proxy`

**Descrição**: Proxy para WuzAPI — alternativa ao Evolution API para gerenciar sessões WhatsApp.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `SUPABASE_ANON_KEY` |
| **Credenciais** | Armazenadas em `whatsapp_instances` (instance_url, api_key) |

**Ações disponíveis** (query param `action`):
- `create` — Cria usuário WuzAPI (admin endpoint)
- `connect` — Inicia sessão e solicita QR Code
- `qrcode` — Obtém QR Code da sessão
- `status` — Consulta estado da conexão
- `disconnect` — Desconecta/logout
- `sendMessage` — Envia mensagem de texto
- `setWebhook` — Configura URL de webhook

---

## 📥 Webhooks

### `asaas-webhook`

**Descrição**: Recebe notificações de pagamento do Asaas e atualiza registros no banco.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma (webhook público) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Recebe payload com `event` e `payment`
2. Mapeia status Asaas → status interno (`CONFIRMED` → `completed`, `OVERDUE` → `overdue`, etc.)
3. Busca `payment_records` pelo `asaas_payment_id`
4. Se a cobrança veio de uma assinatura da plataforma, vincula pelo campo `payment.subscription`
5. Atualiza status e `paid_at` se confirmado
5. Se é compra de tokens e foi paga → credita tokens via RPC `add_tokens`

---

### `gupshup-webhook`

**Descrição**: Recebe callbacks de status de mensagens do Gupshup (WhatsApp Business API).

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma (webhook público) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Extrai telefone e status do payload Gupshup
2. Mapeia status (`delivered`, `read`, `failed`, `sent`)
3. Busca último `message_logs` do telefone no canal WhatsApp
4. Atualiza status do log

---

### `negociarie-callback`

**Descrição**: Recebe callbacks de status de cobranças da Negociarie.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma (webhook público) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Extrai `id_geral`, `id_parcela`, `status` e `id_status`
2. Busca cobrança em `negociarie_cobrancas`
3. Mapeia status Negociarie → status interno (801=pago, 800=registrado, etc.)
4. Atualiza cobrança com novo status e dados do callback
5. Se pago → atualiza `clients.status` para "pago" e cria notificação para operador

---

### `targetdata-webhook`

**Descrição**: Recebe resultados de enriquecimento da Target Data e atualiza dados dos clientes.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Opcional via header `x-webhook-secret` |
| **Secrets** | `TARGETDATA_WEBHOOK_SECRET` (opcional), `SUPABASE_SERVICE_ROLE_KEY` |
| **Config TOML** | `verify_jwt = false` |

**Fluxo**:
1. Valida secret do webhook (se configurado)
2. Aceita payload único ou array (`results[]` ou `data[]`)
3. Para cada registro:
   - Extrai CPF (suporta schema nested `cadastral.nr_cpf` e flat `cpf`)
   - Extrai telefones → classifica (celular/fixo, WhatsApp, prioridade)
   - Extrai emails e endereço
   - Atualiza `clients` (phone, phone2, phone3, email, endereço, enrichment_data)
   - Salva todos os telefones em `client_phones` com upsert
4. Atualiza `enrichment_jobs` se `job_id` fornecido

---

### `whatsapp-webhook`

**Descrição**: Recebe eventos da Evolution API (mensagens, status de conexão) e gerencia conversas.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma (webhook público) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Eventos tratados**:

1. **`connection.update`** — Atualiza status da instância WhatsApp (`connected`/`disconnected`)

2. **`messages.upsert`** — Processa mensagens recebidas/enviadas:
   - Identifica instância pelo `instanceName`
   - Auto-link: busca cliente pelo telefone em `clients`
   - Find-or-create conversa em `conversations`
   - Classifica tipo de mensagem (text, image, audio, video, document, sticker)
   - Calcula SLA deadline (por credor ou global)
   - Atribui operador via round-robin (para novas conversas inbound)
   - Deduplica por `external_id`
   - Insere mensagem em `chat_messages`

3. **`messages.update`** — Atualiza status de entrega (sent → delivered → read)

**Destaques técnicos**:
- Round-robin: conta conversas abertas por operador vinculado à instância
- SLA: busca primeiro por credor (`credores.sla_hours`), fallback para tenant (`tenants.settings.sla_minutes`)
- Busca de cliente por variantes de telefone (com/sem código de país, últimos 10 dígitos)

---

## ⚙️ Automações e Agendamentos

### `auto-break-overdue`

**Descrição**: Marca clientes pendentes com vencimento há +48h como "quebrado" e dispara workflows de quebra.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Calcula data de corte (48h atrás)
2. Atualiza `clients` com `status=pendente` e `data_vencimento <= corte` → `status=quebrado`
3. Busca workflows ativos com `trigger_type=agreement_broken`
4. Para cada cliente quebrado × workflow → chama `workflow-engine`

---

### `auto-expire-agreements`

**Descrição**: Job complexo de expiração de acordos com 3 etapas:

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Etapas**:

1. **Marcar acordos como OVERDUE**: Para cada acordo ativo, monta cronograma virtual de parcelas, calcula valor acumulado esperado, compara com `clients.valor_pago`. Se pago < esperado → marca como overdue e notifica operador.

2. **Cancelar acordos overdue por prazo**: Busca `credores.prazo_dias_acordo` para cada credor. Se dias desde primeiro vencimento ≥ prazo → cancela acordo, reverte clientes para "pendente" com status "Quebra de Acordo", notifica operador.

3. **Marcar parcelas vencidas**: Atualiza `clients` com `status=pendente` e `data_vencimento < hoje` → `status=vencido`.

---

### `auto-status-sync`

**Descrição**: Sincroniza status de cobrança dos clientes com base em regras de negócio.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Regras aplicadas** (em ordem):
1. `em_acordo` → força "Acordo Vigente"
2. `quebrado` → força "Quebra de Acordo"
3. `pago` → força "Quitado"
4. Clientes pendentes/vencidos com "Em dia" e vencimento passado → "Aguardando acionamento"
5. Grupos CPF/credor onde TODAS parcelas são futuras e pendentes → "Em dia"
6. Pendentes sem status e não vencidos → "Em dia"
7. Pendentes/vencidos sem status e vencidos → "Aguardando acionamento"
8. "Em negociação" expirada (por `tempo_expiracao_dias` da regra) → transição automática

---

### `check-sla-expiry`

**Descrição**: Verifica conversas com SLA expirado e notifica operadores.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Busca conversas com `status=open/waiting`, `sla_deadline_at < now()`, `sla_notified_at IS NULL`, com operador atribuído
2. Para cada conversa → insere notificação "SLA Expirado" para o operador
3. Marca conversa como `sla_notified_at = now()`

---

## 🔄 Workflows

### `workflow-engine`

**Descrição**: Motor de execução de fluxos visuais. Processa nós sequencialmente seguindo edges do grafo.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Tipos de nós suportados**:
- `trigger_*` — Nós de gatilho (início do fluxo)
- `action_whatsapp` — Envia WhatsApp via Evolution API com template de variáveis
- `action_sms` — Enfileira SMS (placeholder)
- `action_wait` — Pausa execução por N dias (status → `waiting`, define `next_run_at`)
- `action_ai_negotiate` — Enfileira negociação IA (placeholder)
- `action_update_status` — Atualiza status do cliente
- `condition_score` / `condition_value` — Condicionais (propensity score ou valor da parcela, operador >/< )

**Trigger por webhook**: Aceita `trigger_type=webhook` + `webhook_token` para iniciar fluxos externamente.

**Segurança**: Limite de 50 nós por execução (safety counter).

---

### `workflow-resume`

**Descrição**: Retoma execuções de workflow pausadas (status `waiting`) cujo `next_run_at` já passou.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Busca `workflow_executions` com `status=waiting` e `next_run_at <= now()`
2. Para cada execução → chama `workflow-engine` com `resume_from_node` e `execution_id`

---

### `workflow-trigger-overdue`

**Descrição**: Trigger automático de workflows para clientes com vencimento atrasado.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Busca workflows ativos com `trigger_type=overdue`
2. Extrai `days` do nó trigger
3. Busca clientes do tenant com `data_vencimento <= (hoje - days)` e status ≠ pago/quebrado
4. Verifica duplicidade (execução ativa para mesmo workflow+cliente)
5. Dispara `workflow-engine` para cada par

---

### `workflow-trigger-no-contact`

**Descrição**: Trigger automático de workflows para clientes sem contato recente.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Busca workflows ativos com `trigger_type=first_contact`
2. Extrai `days` do nó trigger (default: 7)
3. Para cada cliente ativo do tenant:
   - Busca último registro em `message_logs`
   - Se sem contato ou contato mais antigo que `days` dias → dispara workflow
4. Verifica duplicidade antes de disparar

---

## 🧠 Inteligência Artificial

### `calculate-propensity`

**Descrição**: Calcula score de propensão ao pagamento usando IA (Gemini Flash Lite) com fallback heurístico.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `LOVABLE_API_KEY`, `SUPABASE_ANON_KEY` |
| **Modelo IA** | `google/gemini-2.5-flash-lite` |

**Fluxo**:
1. Busca todos os clientes do tenant (ou por CPF específico)
2. Agrupa por CPF
3. Gera resumo estatístico por devedor (total, pagos, pendentes, quebrados, vencidos, taxa)
4. Envia em lotes de 50 para a IA com tool calling (`return_scores`)
5. **Fallback heurístico** se IA falhar: `score = rate*60 + (1 - broken/total)*25 - overdue*5 + 15`
6. Atualiza `clients.propensity_score` para ambas variantes de CPF

---

### `chat-ai-suggest`

**Descrição**: Assistente de IA para operadores de cobrança — sugere respostas, resume conversas e classifica intenções.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `LOVABLE_API_KEY` |
| **Modelo IA** | `google/gemini-3-flash-preview` |

**Ações disponíveis** (campo `action` no body):
- `suggest` — Gera sugestão de resposta para operador (streaming SSE)
- `summarize` — Resumo da conversa em bullet points
- `classify` — Classifica intenção do cliente via tool calling (`classify_intent`)

**Intenções classificáveis**: negociação, pagamento, dúvida, reclamação, cancelamento, informação, acordo, inadimplência, outro.

**Contexto usado**: Últimas 30 mensagens + dados do cliente vinculado (nome, CPF, credor, status, parcela, valor).

---

### `support-ai-chat`

**Descrição**: Chatbot de suporte do sistema RIVO com base de conhecimento embutida.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma |
| **Secrets** | `LOVABLE_API_KEY` |
| **Modelo IA** | `google/gemini-3-flash-preview` |

**Fluxo**:
1. Recebe `message` e `history` no body
2. Usa system prompt com guias do sistema (Dashboard, Carteira, Acordos, Contact Center, Automação, Cadastros, Portal)
3. Retorna resposta em streaming SSE
4. Trata erros 429 (rate limit) e 402 (créditos esgotados)

---

## 👤 Usuários e Auth

### `create-user`

**Descrição**: Cria usuário no tenant do admin chamador ou atualiza senha de usuário existente.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT, requer role admin/super_admin) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |

**Ações**:
- **Criar usuário**: Campos `full_name`, `email`, `password`, `role`, `cpf`, `phone`, `permission_profile_id`, `commission_grade_id`, `threecplus_agent_id`, `instance_ids`
  1. Cria usuário em `auth.users` via Admin API
  2. Insere `tenant_users` com role do tenant
  3. Upsert `profiles` com dados adicionais
  4. Vincula instâncias WhatsApp em `operator_instances`
  5. Rollback se qualquer etapa falhar

- **Atualizar senha** (`action: "update_password"`): Valida que o usuário pertence ao mesmo tenant.

---

### `accept-invite`

**Descrição**: Aceita um link de convite e adiciona o usuário ao tenant.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma (token do convite no body) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Valida token do convite (`invite_links.token`, não expirado, não usado)
2. Insere `tenant_users` com role do convite
3. Atualiza `profiles.tenant_id`
4. Marca convite como usado

---

## 🪙 Tokens e Pagamentos

### `purchase-tokens`

**Descrição**: Processa compra de pacotes de tokens. Simula aprovação imediata (integração com gateway pendente).

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT, requer role admin/super_admin) |
| **Secrets** | `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Valida usuário e role (admin/super_admin)
2. Busca pacote ativo em `token_packages`
3. Cria `payment_records` com status "pending"
4. Credita tokens via RPC `add_tokens` (total = token_amount + bonus_tokens)
5. Atualiza payment para "completed"

---

### `consume-tokens`

**Descrição**: Consome tokens de um tenant para uso de serviços, com validação de saldo e logging.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT do usuário) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |

**Fluxo**:
1. Valida usuário
2. Verifica serviço ativo em `service_catalog` e `tenant_services`
3. Consome tokens via RPC `consume_tokens`
4. Registra uso em `service_usage_logs`
5. Verifica alerta de saldo baixo (`low_balance_threshold`)

---

## 🌐 Portal do Devedor

### `portal-lookup`

**Descrição**: Consulta de dívidas e criação de acordos pelo portal público do devedor.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma (portal público) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Ações disponíveis** (campo `action` no body):
- `tenant-info` — Retorna dados públicos do tenant + branding do primeiro credor com portal ativo
- *default* (sem action) — Busca dívidas por CPF + configurações do credor (desconto máximo, parcelas, juros, multa, assinatura)
- `create-portal-agreement` — Cria acordo via portal com checkout token
- `request_agreement` (legado) — Cria acordo simplificado

**Destaques**:
- Aceita CPF limpo ou formatado (busca ambas variantes)
- Retorna configurações de portal por credor (cores, logo, textos, assinatura)

---

### `portal-checkout`

**Descrição**: Processa pagamentos e assinaturas de acordos no portal do devedor.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Via `checkout_token` (não JWT) |
| **Secrets** | `NEGOCIARIE_CLIENT_ID`, `NEGOCIARIE_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |

**Ações disponíveis** (campo `action` no body):
- `get-agreement` — Retorna acordo + pagamentos existentes + dados do tenant
- `create-payment` — Cria cobrança via Negociarie (PIX ou cartão), valida total
- `payment-status` — Lista pagamentos do acordo
- `check-signature` — Verifica se acordo já foi assinado
- `save-signature` — Salva assinatura (tipos: click, draw, facial)
  - Upload de imagem para Storage (`agreement-signatures` bucket)
  - Upload de fotos faciais (múltiplas)
  - Captura IP e User-Agent

---

## 📱 WhatsApp

### `send-bulk-whatsapp`

**Descrição**: Envia mensagens WhatsApp em massa para lista de clientes.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Bearer Token (JWT, requer role admin/super_admin) |
| **Secrets** | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `SUPABASE_ANON_KEY` |

**Fluxo**:
1. Valida admin
2. Detecta provider WhatsApp do tenant (Gupshup ou Baylers/Evolution)
3. Busca credenciais (whatsapp_instances > global secrets > legacy settings)
4. Para cada cliente:
   - Substitui variáveis no template: `{{nome}}`, `{{cpf}}`, `{{valor_parcela}}`, `{{data_vencimento}}`, `{{credor}}`
   - Envia via provider escolhido
   - Registra em `message_logs`
5. Throttle: 100ms entre mensagens

---

### `whatsapp-webhook`

> Já documentado na seção [Webhooks](#whatsapp-webhook).

---

## 📊 Relatórios e Notificações

### `send-notifications`

**Descrição**: Executa a régua de cobrança automática — envia mensagens baseadas em regras configuradas.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Service Role (cron job) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |

**Fluxo**:
1. Busca todos os tenants ativos
2. Para cada tenant → busca regras ativas em `collection_rules`
3. Para cada regra:
   - Calcula data alvo: `hoje - days_offset`
   - Busca clientes pendentes com vencimento na data alvo
   - Substitui variáveis no template
   - Envia WhatsApp via Gupshup (se configurado)
   - Registra email (placeholder — provider não integrado)
   - Registra tudo em `message_logs`

---

### `send-quitados-report`

**Descrição**: Envia por e-mail relatório CSV de clientes quitados excluídos do sistema.

| Item | Valor |
|------|-------|
| **Método HTTP** | POST |
| **Autenticação** | Nenhuma |
| **Secrets** | `RESEND_API_KEY` |

**Fluxo**:
1. Recebe lista de clientes, email do admin e email do destinatário
2. Gera CSV com colunas: Nome, CPF, Credor, Parcela, Valor, Valor Pago, Vencimento, Quitação, Status
3. Envia email via Resend com CSV em anexo (base64)
4. Remetente: `RIVO CONNECT <noreply@resend.dev>`

---

## 📦 API Pública

### `clients-api`

**Descrição**: API REST completa para integrações externas — CRUD de clientes, acordos, pagamentos, status e mais.

| Item | Valor |
|------|-------|
| **Método HTTP** | GET, POST, PUT, DELETE |
| **Autenticação** | `X-API-Key` (SHA-256 hash validado contra `api_keys`) |
| **Secrets** | `SUPABASE_SERVICE_ROLE_KEY` |
| **Linhas de código** | ~787 |

**Endpoints**:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check (sem auth) |
| GET | `/clients` | Lista clientes (paginação, filtros por status/credor/cpf) |
| GET | `/clients/:id` | Detalhe de cliente |
| POST | `/clients` | Upsert único (suporta formato mailing: `NOME_DEVEDOR`, `CNPJ_CPF`, etc.) |
| POST | `/clients/bulk` | Upsert em massa (max 500 registros, suporta `mapping_id` customizado) |
| PUT | `/clients/:id` | Atualização parcial |
| PUT | `/clients/:id/status` | Atualiza status de cobrança |
| DELETE | `/clients/:id` | Remove cliente |
| GET | `/agreements` | Lista acordos |
| POST | `/agreements` | Cria acordo |
| PUT | `/agreements/:id/status` | Atualiza status do acordo |
| GET | `/status-types` | Lista tipos de status do tenant |
| GET | `/credores` | Lista credores |
| POST | `/propensity` | Dispara cálculo de propensity score |
| POST | `/whatsapp/bulk` | Dispara envio bulk WhatsApp |
| POST | `/portal/lookup` | Consulta portal do devedor |
| POST | `/webhooks` | Registra webhook |
| GET | `/webhooks` | Lista webhooks |
| DELETE | `/webhooks/:id` | Remove webhook |

**Destaques técnicos**:
- Normalização de campos de mailing (ex: `NOME_DEVEDOR` → `nome_completo`, `VL_TITULO` → `valor_parcela`)
- Conversão de datas BR (DD/MM/YYYY → YYYY-MM-DD)
- Composição de endereço (rua + número + complemento + bairro)
- Validação detalhada com erros descritivos
- Registro de importação em `import_logs`
- Atualização de `api_keys.last_used_at`
- Paginação com max 500 registros por página

---

## 🔐 Referência de Secrets

| Secret | Funções que usam | Descrição |
|--------|-----------------|-----------|
| `SUPABASE_URL` | Todas | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Todas (operações admin) | Chave com permissões elevadas |
| `SUPABASE_ANON_KEY` | Proxies com auth JWT | Chave anônima para validar tokens |
| `LOVABLE_API_KEY` | `calculate-propensity`, `chat-ai-suggest`, `support-ai-chat` | Gateway de IA Lovable |
| `EVOLUTION_API_URL` | `evolution-proxy`, `send-bulk-whatsapp` | URL da Evolution API |
| `EVOLUTION_API_KEY` | `evolution-proxy`, `send-bulk-whatsapp` | Chave da Evolution API |
| `NEGOCIARIE_CLIENT_ID` | `negociarie-proxy`, `portal-checkout` | Client ID OAuth2 Negociarie |
| `NEGOCIARIE_CLIENT_SECRET` | `negociarie-proxy`, `portal-checkout` | Client Secret OAuth2 Negociarie |
| `ASAAS_API_KEY_SANDBOX` | `asaas-proxy` | Chave API Asaas do tenant (sandbox) |
| `ASAAS_API_KEY_PRODUCTION` | `asaas-proxy` | Chave API Asaas do tenant (produção) |
| `ASAAS_PLATFORM_API_KEY_SANDBOX` | `asaas-platform-proxy` | Chave API Asaas da plataforma (sandbox) |
| `ASAAS_PLATFORM_API_KEY_PRODUCTION` | `asaas-platform-proxy` | Chave API Asaas da plataforma (produção) |
| `TARGETDATA_API_KEY` | `targetdata-enrich` | Chave API Target Data |
| `TARGETDATA_API_SECRET` | `targetdata-enrich` | Secret API Target Data |
| `TARGETDATA_WEBHOOK_SECRET` | `targetdata-webhook` | Secret para validar webhooks Target Data |
| `WUZAPI_URL` | — (legado) | URL do WuzAPI (agora por instância) |
| `WUZAPI_ADMIN_TOKEN` | — (legado) | Token admin do WuzAPI |
| `RESEND_API_KEY` | `send-quitados-report` | Chave API Resend (envio de emails) |

### Configuração TOML

```toml
# supabase/config.toml — Funções com verify_jwt = false
[functions.targetdata-webhook]
verify_jwt = false

[functions.targetdata-enrich]
verify_jwt = false
```

> Todas as demais funções usam `verify_jwt = true` (padrão) mas fazem validação manual do JWT no código para maior controle.
