

# Fase 3 - Disparo de WhatsApp em Lote + Fase 4 - Automacoes pos-tabulacao

## Fase 3: Disparo de WhatsApp em Lote

### O que sera feito

A pagina de Carteira ja possui selecao multipla (checkboxes) e um botao para o Discador. Vamos adicionar um botao similar "WhatsApp" que abre um dialog para disparo em lote.

### Componentes

1. **Botao "WhatsApp (N)" na Carteira** - Aparece quando ha clientes selecionados, ao lado do botao "Discador"

2. **WhatsAppBulkDialog** - Novo componente com:
   - Quantidade de clientes selecionados
   - Selecao de template (carrega regras do `collection_rules` do tenant)
   - Opcao de digitar mensagem personalizada
   - Preview da mensagem com dados do primeiro cliente
   - Barra de progresso durante envio
   - Resultado final (enviados / falhas)

3. **Edge function `send-bulk-whatsapp`** - Nova funcao que:
   - Recebe lista de client_ids e template/mensagem
   - Busca credenciais Gupshup do tenant
   - Envia mensagens em sequencia (com throttling para nao exceder rate limit)
   - Registra cada envio na tabela `message_logs`
   - Retorna contagem de sucesso/falha

### Fluxo do usuario

```text
Carteira -> Selecionar clientes -> Botao "WhatsApp (5)"
  -> Dialog abre
  -> Escolhe template ou digita mensagem
  -> Preview
  -> Clica "Enviar"
  -> Progresso em tempo real
  -> Resultado: "4 enviados, 1 falha (sem telefone)"
```

---

## Fase 4: Automacoes pos-tabulacao

### O que sera feito

Vincular tipos de tabulacao a acoes automaticas. Quando o operador tabula um atendimento, o sistema pode disparar acoes configuradas pelo admin.

### Mudancas no banco de dados

Nova tabela `disposition_automations`:
- `id` (uuid, PK)
- `tenant_id` (uuid, NOT NULL)
- `disposition_type` (text, NOT NULL) -- ex: "negotiated", "promise", "callback"
- `action_type` (text, NOT NULL) -- ex: "send_whatsapp", "send_payment_link", "schedule_reminder"
- `action_config` (jsonb) -- configuracao da acao (template, delay, etc)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

Com RLS:
- Admins do tenant podem gerenciar (ALL)
- Usuarios do tenant podem visualizar (SELECT)

### Tipos de acao suportados

| action_type | Descricao | action_config |
|---|---|---|
| `send_whatsapp` | Envia mensagem WhatsApp ao cliente | `{ template: "..." }` |
| `send_payment_link` | Gera cobranca Negociarie e envia link | `{ tipo: "pix" }` |
| `schedule_reminder` | Cria notificacao para o operador | `{ delay_hours: 24, message: "..." }` |

### Componentes

1. **Aba "Pos-Tabulacao" na pagina de Automacao** - Nova aba no `AutomacaoPage` com:
   - Lista de automacoes configuradas (por tipo de tabulacao)
   - Formulario para criar/editar automacao
   - Toggle ativar/desativar

2. **Execucao no DispositionPanel** - Apos salvar tabulacao com sucesso, busca automacoes vinculadas e executa:
   - `send_whatsapp`: chama funcao de envio existente
   - `schedule_reminder`: cria notificacao via `create_notification`
   - `send_payment_link`: chama edge function Negociarie

### Servico `dispositionAutomationService.ts`

- `fetchAutomations(tenantId)` - lista automacoes
- `createAutomation(data)` - cria nova
- `updateAutomation(id, data)` - atualiza
- `deleteAutomation(id)` - remove
- `executeAutomations(tenantId, dispositionType, clientId)` - executa acoes vinculadas

---

## Detalhes tecnicos

### Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `src/components/carteira/WhatsAppBulkDialog.tsx` | Dialog de disparo em lote |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Edge function para envio em lote |
| `src/services/dispositionAutomationService.ts` | CRUD + execucao de automacoes |
| `src/components/automacao/DispositionAutomationsTab.tsx` | UI de gestao das automacoes |
| `src/components/automacao/DispositionAutomationForm.tsx` | Formulario de criacao/edicao |

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/CarteiraPage.tsx` | Adicionar botao WhatsApp e importar dialog |
| `src/pages/AutomacaoPage.tsx` | Adicionar aba "Pos-Tabulacao" |
| `src/pages/AtendimentoPage.tsx` | Executar automacoes apos tabulacao |
| `supabase/config.toml` | Registrar nova edge function |

### Migracao SQL

```text
1. Criar tabela disposition_automations com RLS
2. Politicas: admin manage, users select
```

### Ordem de implementacao

1. Migracao SQL (tabela disposition_automations)
2. Edge function send-bulk-whatsapp
3. WhatsAppBulkDialog + integracao na Carteira
4. Servico dispositionAutomationService
5. UI de automacoes na pagina de Automacao
6. Execucao automatica no fluxo de tabulacao

