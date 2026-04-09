

# Adicionar botão "Ver Logs" do webhook Gupshup

## O que será feito

Adicionar um botão "Ver Logs" ao lado do webhook URL no card Gupshup. Ao clicar, abre um dialog/modal mostrando os logs mais recentes da edge function `gupshup-webhook`, buscados via `supabase.functions.invoke` de uma nova edge function auxiliar.

## Abordagem

### 1. Nova Edge Function `webhook-logs` 

Cria uma edge function que usa a Analytics API do Supabase para buscar os logs da function `gupshup-webhook` e retornar ao frontend. Usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para consultar os logs via endpoint interno de analytics.

### 2. Botão + Dialog no `WhatsAppIntegrationTab.tsx`

- Adicionar botão "Ver Logs" (ícone `ScrollText`) ao lado do botão de copiar webhook
- Ao clicar, chama a edge function `webhook-logs` 
- Exibe os resultados em um `Dialog` com scroll, mostrando timestamp, tipo de evento e mensagem
- Cada log formatado com cores (erro = vermelho, info = normal)

### Arquivos alterados

1. **Novo**: `supabase/functions/webhook-logs/index.ts` — busca logs da edge function gupshup-webhook via API de analytics
2. **Editado**: `src/components/integracao/WhatsAppIntegrationTab.tsx` — adiciona botão + dialog de logs

