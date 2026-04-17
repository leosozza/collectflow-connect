
## Análise

O usuário tem 3 status de conversa: **ABERTA**, **AGUARDANDO**, **FECHADA**. Quer entender o que aconteceu com conversas que aparentemente "fecharam ontem" e garantir que apareçam corretamente na aba "FECHADA".

Pelo diagnóstico anterior:
- O autoclose runner não está agendado via cron, então não fechou nada automaticamente.
- 0 conversas com `status = 'closed'` nos últimos 3 dias para o tenant Y.BRASIL.

Preciso investigar mais a fundo:
1. Quantas conversas existem em cada status hoje no tenant
2. Conversas com `last_interaction_at` > 48h que estão como `open`/`waiting` (deveriam estar fechadas pela regra)
3. Verificar se houve fechamentos via UI (sem registro de auto_close)
4. Confirmar se o filtro de "Fechadas" na inbox está funcionando

## Plano

### Passo 1 — Diagnóstico completo (read-only SQL)
Rodar queries no banco para responder:
- Total de conversas por status no tenant Y.BRASIL
- Conversas elegíveis ao autoclose (open/waiting + inatividade > 48h) — essas deveriam ter sido fechadas
- Histórico de mudanças de status nas últimas 48h (via `client_events` ou audit)
- Verificar se a inbox está exibindo corretamente as conversas com `status = 'closed'`

### Passo 2 — Executar o fechamento retroativo
Como o cron nunca rodou, as conversas inativas há mais de 48h continuam abertas. Vou:
- Invocar manualmente o edge function `whatsapp-autoclose-runner` UMA VEZ para fechar o backlog
- Isso usa exatamente a regra configurada (48h, status open/waiting, oficial+não-oficial)
- As conversas fechadas receberão tabulação `auto_close` e evento `conversation_auto_closed`

### Passo 3 — Agendar o cron para que isso não se repita
Criar job `pg_cron` para executar o runner a cada 1 hora automaticamente. Sem isso, o autoclose continua inerte.

### Passo 4 — Validar na UI
Confirmar que após o fechamento:
- A aba "FECHADAS" no /contact-center/whatsapp passa a listar essas conversas
- O contador de fechadas atualiza
- Filtro por tabulação `auto_close` funciona

## Detalhes técnicos
- `whatsapp-autoclose-runner` já existe e está pronto (li o código). Só precisa ser chamado.
- O cron usará `net.http_post` com a service_role key, hora cheia, todos os tenants.
- A query `fetchConversationCounts` já conta `status='closed'` corretamente — não precisa alteração de código.
- Nenhuma alteração de schema necessária; apenas dados + 1 cron job.

## Pergunta antes de executar
Antes de fechar conversas em massa, preciso confirmar a janela de inatividade que você quer aplicar **agora** no backlog (a regra atual configurada é 48h):

- **A.** Usar 48h (configuração atual) — fecha tudo que está parado há mais de 2 dias
- **B.** Usar uma janela diferente apenas para esse fechamento retroativo (ex: 24h, 72h, 7 dias)
- **C.** Listar primeiro quantas conversas serão afetadas, e só então decidir
