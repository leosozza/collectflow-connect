

# Registrar logs do "Testar Conexão" na mesma caixa de logs do webhook

## O que será feito

Quando o usuário clicar em "Testar Conexão", o resultado (sucesso ou erro) será salvo na tabela `webhook_logs` com `function_name = 'gupshup-proxy'`. Assim, ao abrir o dialog de logs, os testes de conexão aparecerão junto com os logs do webhook.

## Alterações

### 1. `src/components/integracao/WhatsAppIntegrationTab.tsx` — `handleTestConnection`

Após receber a resposta do `gupshup-proxy`, inserir um registro na tabela `webhook_logs`:
- **Sucesso**: `event_type = 'success'`, mensagem "Conexão testada com sucesso"
- **Erro**: `event_type = 'error'`, mensagem com o detalhe do erro

Também atualizar a query de `handleFetchLogs` para buscar logs de ambas as functions (`gupshup-webhook` e `gupshup-proxy`), usando `.in("function_name", ["gupshup-webhook", "gupshup-proxy"])`.

### 2. `supabase/functions/gupshup-proxy/index.ts`

Adicionar escrita na tabela `webhook_logs` diretamente na edge function, registrando a resposta raw da Gupshup (status, corpo) para diagnóstico completo. Usar o service role key disponível via `Deno.env`.

## Arquivos alterados

1. **`src/components/integracao/WhatsAppIntegrationTab.tsx`** — inserir log após teste + expandir query de logs
2. **`supabase/functions/gupshup-proxy/index.ts`** — registrar resultado na `webhook_logs`

