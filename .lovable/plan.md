

## Análise das falhas — Disparo carteira 09:33

### Status atual da campanha
- **ID**: `9c838ab5-ecfc-4fbd-bc5c-3a9e5b5d4672`
- **Status**: `sending` (em andamento, ~10% processado)
- **Total**: 199 destinatários únicos
- **Processados até agora**: 18 (3 sent + 10 delivered + 1 read + 4 failed)
- **Pendentes**: 181
- **Watchdog do dispatcher está re-invocando** o worker normalmente (visto nos logs).

A campanha está rodando saudável. As 4 falhas são pontuais e não-bloqueantes — o motor continua processando os 181 pendentes.

### Diagnóstico das 4 falhas

Todas as 4 falhas vieram do mesmo erro do provider Evolution: **HTTP 400 — `exists: false`** (número não existe no WhatsApp). Detalhes:

| Cliente | Telefone armazenado | Enviado (E.164) | JID verificado pelo Evolution | Causa |
|---|---|---|---|---|
| Luana Monteiro Pires | `00000000000` | `5500000000000` | `5500000000000` | **Telefone placeholder** — cadastro inválido na carteira |
| Kelly Caroline Ruy Matos | `44984539181` | `5544984539181` | `554484539181` | Evolution removeu o **9** para checar formato antigo; o número antigo de 8 dígitos (DDD 44) **não tem WhatsApp** |
| Ionise Alves Moreira | `38988071653` | `5538988071653` | `553888071653` | Mesma situação — Evolution removeu o 9, número antigo não existe |
| Angelina dos Santos Delmondes | `11978369935` | `5511978369935` | `5511978369935` | Número simplesmente **não tem WhatsApp ativo** |

### Causas-raiz e soluções propostas

**Problema 1 — Telefones placeholder (00000000000) na carteira**

Estão sendo selecionados destinatários com telefones obviamente inválidos. Solução:

- Adicionar **validação no momento do cálculo da audiência da campanha** em `src/services/whatsappCampaignService.ts` (função `isValidPhone`): rejeitar números com todos os dígitos iguais (`/^(\d)\1+$/`), começando com 0, ou compostos só por 0s/1s repetidos.
- Esses contatos seriam contados como "excluídos por telefone inválido" no resumo da campanha (já existe `excludedCount`).

**Problema 2 — Números sem WhatsApp ativo (Kelly, Ionise, Angelina)**

Não tem como saber antes de enviar — o Evolution só responde isso ao tentar. Mitigações:

- **Opção A (recomendada)**: marcar destinatários que falharem com `exists:false` em uma lista de "telefones sem WhatsApp" por tenant (nova tabela `tenant_invalid_whatsapp_phones` com `phone`, `last_checked_at`, `verified_invalid_count`). Próximas campanhas pulam telefones já verificados como inválidos nos últimos 30 dias.
- **Opção B (mais simples)**: marcar a coluna `phone_has_whatsapp = false` no `client_profiles` quando recebermos `exists:false`, e excluir esses na seleção da audiência.

**Problema 3 — Sem visibilidade da causa do erro na UI**

Hoje o `error_message` é JSON cru. Adicionar na aba "Resumo" da campanha (`CampaignSummaryTab.tsx`) uma **seção de falhas agrupadas por causa**:
- "Telefone inválido" (placeholders)
- "Sem WhatsApp" (`exists:false`)
- "Erro de instância" (timeout, conexão)
- "Outros"

Cada grupo mostra contagem e botão "Ver lista" para auditoria.

### Plano de implementação (3 mudanças)

1. **Filtro de placeholders** em `src/services/whatsappCampaignService.ts` — função `isValidPhone` rejeita repetições e padrões inválidos. (~10 linhas)

2. **Persistir telefones sem WhatsApp** — opção B: migration adicionando coluna `phone_has_whatsapp boolean` em `client_profiles`; ajustar `supabase/functions/send-bulk-whatsapp/index.ts` (worker) para, ao receber `exists:false`, fazer `update client_profiles set phone_has_whatsapp=false` pelo telefone normalizado; ajustar a query de seleção de audiência para excluir.

3. **Painel de falhas agrupadas** em `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` — parser de `error_message` que classifica em 4 grupos com contagem e drill-down.

### Validação

1. Acompanhar o término da campanha 09:33 → comparar `failed_count` final com a categorização nova.
2. Próximo disparo: confirmar que telefones `00000000000` saem pré-excluídos do total e aparecem como "excluídos" no resumo.
3. Disparo seguinte: confirmar que números marcados como `phone_has_whatsapp=false` na rodada anterior são automaticamente pulados.

