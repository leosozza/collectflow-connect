

## Teste end-to-end da Régua de Cobrança

Vou rodar a bateria completa de validação em ambiente real, sem disparar mensagens para destinatários reais (uso instância de teste / verificação de logs).

### Bateria de testes

**1. Inventário (SQL read-only)**
- Listar regras ativas em `collection_rules` por tenant: `id, name, days_offset, channel, credor_id, instance_id`.
- Confirmar cron `send-notifications` ativo em `cron.job` + últimas execuções em `cron.job_run_details`.
- Conferir que as instâncias referenciadas estão `connected` em `whatsapp_instances`.

**2. Dry-run de prevenção (D-N)**
- Para cada regra com `days_offset < 0`, calcular `target_date = hoje - days_offset`.
- Query: quantos clientes elegíveis existem (`tenant_id`, `credor_id` da regra, `data_vencimento = target_date`, status em `[pendente, em_dia, EM ABERTO, INADIMPLENTE]`).
- Reporto: "Regra X bateria Y clientes hoje" — mostra se a regra **encontraria alvos**.

**3. Dry-run de cobrança (D+N)**
- Mesmo procedimento para regras com `days_offset >= 0`.

**4. Execução real controlada**
- Invocar `send-notifications` via `supabase--curl_edge_functions`.
- Capturar resposta `{ sent, failed, skipped_duplicates }`.
- Ler logs da função (`supabase--edge_function_logs send-notifications`) para detectar erros silenciosos.

**5. Auditoria pós-execução**
- `message_logs` das últimas 2h com `metadata->>rule_id` preenchido: confere `status`, `provider`, `instance_id`.
- `client_events` das últimas 2h com `event_source in ('prevention','collection')`: confere se a timeline foi alimentada.
- Conferir idempotência: contar duplicatas por `(rule_id, client_id, date(created_at))` — esperado 0.

**6. Teste de idempotência ativa**
- Re-invocar `send-notifications` imediatamente.
- Esperado: `sent=0` (ou só novos alvos), `skipped_duplicates > 0`.

**7. Diagnóstico final**
Relatório consolidado:
- Regras ativas vs regras com alvos hoje
- Disparos enviados / falhados / pulados por duplicata
- Instâncias usadas e providers
- Linhas criadas em `client_events` (timeline OK?)
- Bugs ou warnings encontrados nos logs

### Critérios de sucesso

- Cron rodando sem erros recentes.
- Pelo menos uma regra com alvo hoje dispara e gera `message_logs.status='sent'` + `client_events`.
- Re-invocação não duplica.
- Nenhum erro 500 ou exceção nos logs da edge function.

### Se algo falhar

Identifico a causa raiz (RLS, instância desconectada, template inválido, payload malformado para o provider) e proponho correção pontual antes de prosseguir.

### Fora de escopo

- Criar regras novas de teste (uso as que já existem).
- Disparo para destinatário externo real desconhecido (uso apenas o que o cron faria naturalmente; se houver risco de mensagem real, paro e peço confirmação).
- Mexer em automação/workflows.

### Próximo passo

Confirme **"Executar testes"** e eu rodo a bateria completa, trazendo o relatório com os números.

