## Objetivo

Resolver dois problemas detectados na análise do WhatsApp **sem tocar no fluxo de envio em produção** (zero risco de perder conversas).

## O que vai mudar

### 1. Destravar campanha "Disparo carteira 10:50"
Campanha `31fa269b-3e8f-4133-a317-ff6fd0bf7581` está em `sending` há ~3h30 mas já tem `sent + failed + delivered + read = 75 = total_selected`. Não há mais nada para enviar — o finalizador simplesmente não fechou o status.

**Ação**: rodar 1 UPDATE pontual (via insert tool):
```sql
UPDATE whatsapp_campaigns
SET status = 'completed_with_errors',
    completed_at = now(),
    processing_locked_at = NULL,
    processing_locked_by = NULL
WHERE id = '31fa269b-3e8f-4133-a317-ff6fd0bf7581'
  AND status = 'sending';
```
Não interfere em nenhuma conversa, não reenvia mensagens, apenas corrige o status visual.

### 2. Gravar erro nas mensagens manuais que falharem
Hoje quando uma mensagem manual no chat falha (caso da Nieli/boleto PDF), o `chat_messages.metadata` fica `{}` — impossível diagnosticar. Vou alterar `supabase/functions/send-chat-message/index.ts` para, **logo depois** de gravar a mensagem com `status='failed'`, fazer um UPDATE em `metadata` com:
- `send_error.provider` (evolution/gupshup/wuzapi)
- `send_error.media_type` e `mime_type`
- `send_error.raw` (resposta completa do provedor)
- `send_error.at` (timestamp)

A mudança é **aditiva**:
- Não muda o caminho de sucesso (mensagem que envia OK continua igual).
- Não retenta envio nem altera a resposta da função para o cliente.
- Apenas escreve mais informação na linha que já estava sendo gravada como falha.

Risco: praticamente zero. Se o UPDATE de metadata falhar, é capturado em try/catch e logado, sem afetar a resposta.

### 3. (Opcional / fora deste plano)
- **Reconectar instância default `Acordos Vitor Santana`** — ação manual no painel (Configurações → WhatsApp → Reconectar). Não vou tocar.
- **Normalização de telefone E.164** — alguns números vão para o Evolution sem o 9º dígito (ex: `559299652127`). Essa investigação mexe no caminho crítico de envio em massa, então prefiro deixar para um próximo ciclo isolado, com testes.

## Arquivos afetados

- `supabase/functions/send-chat-message/index.ts` — adicionar bloco de stamp de erro após o `ingest_channel_event` de falha (linhas ~313-329).
- 1 UPDATE de dados via insert tool na tabela `whatsapp_campaigns` (1 linha).

## O que NÃO vai mudar

- Nenhuma mensagem existente será reenviada.
- Nenhuma conversa será fechada, transferida ou reatribuída.
- Webhook de entrada (`whatsapp-webhook`) intocado.
- Engine de campanhas (`send-bulk-whatsapp`) intocada.
- Schema do banco intocado (sem migration).