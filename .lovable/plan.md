

## Plano: Validação end-to-end do Agendamento de Disparos

Vou executar uma bateria de testes reais no sistema de agendamento para confirmar que tudo está operacional antes de liberar para uso em produção.

### Testes a executar

**1. Infraestrutura (via SQL)**
- Confirmar cron `wa-campaign-scheduler` ativo e rodando a cada 1 min (`cron.job` + últimas execuções em `cron.job_run_details`).
- Validar que o `net.http_post` está retornando 200 nas últimas chamadas.

**2. Edge Function `dispatch-scheduled-campaigns`**
- Chamar manualmente via `curl_edge_functions` e conferir resposta `{ok:true, scanned, processed}`.
- Verificar logs para garantir ausência dos erros `utf-8-validate` / `bufferutil` (são warnings benignos do supabase-js, mas vou confirmar que não bloqueiam execução).

**3. Teste funcional — campanha one-shot**
- Inserir via SQL uma campanha de teste com `status='scheduled'`, `schedule_type='once'`, `scheduled_for = now() - 10s`, 0 destinatários (apenas para validar o pickup do dispatcher sem disparar mensagens reais).
- Aguardar 60-90s, confirmar que status mudou para `sending` ou `completed` e que o `started_at` foi preenchido.
- Verificar entrada em `audit_logs` com `action='scheduled_campaign_triggered'`.

**4. Teste funcional — campanha recorrente**
- Inserir campanha `schedule_type='recurring'`, regra diária 08:00, `scheduled_for = now() - 10s`, 0 destinatários.
- Aguardar ciclo, confirmar:
  - Lock atômico funcionou (mãe com `scheduled_for=null` durante processamento).
  - `recurrence_run_count` incrementou.
  - Próximo `scheduled_for` calculado corretamente (+1 dia às 08:00 America/Sao_Paulo).
  - Entrada em `whatsapp_campaign_runs` criada.
  - Campanha filha criada com `parent_campaign_id` correto.

**5. Teste de race condition**
- Invocar o dispatcher 3x em paralelo contra a mesma campanha recorrente pendente.
- Confirmar que apenas 1 filha foi criada (lock atômico impede duplicação).

**6. Limpeza**
- Remover campanhas de teste + `whatsapp_campaign_runs` + `audit_logs` gerados.

### Saída esperada
Relatório curto com cada teste marcado como ✅ / ❌ + prints dos dados relevantes (IDs, timestamps, status transitions). Se algum teste falhar, identifico a causa e proponho correção pontual.

### Fora de escopo
- Disparo real com destinatários (evita consumir tokens / gerar mensagens de teste em WhatsApp).
- Teste de UI (já validada na iteração anterior).
- Stress test de volume (não é um requisito agora).

### Próximo passo
Confirme **"Executar testes"** e eu rodo toda a bateria acima, trazendo o relatório com os resultados. Se tudo passar, o sistema está 100% liberado para uso.

