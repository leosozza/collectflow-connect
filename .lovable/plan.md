

# Plano: Corrigir vinculação de agentes e melhorar gestão de campanhas

## Problemas identificados

### 1. Aggressividade não salva — campo errado no proxy
O `CampaignsPanel` chama `invoke("update_campaign", { campaign_id, aggressiveness: X })` mas o proxy monta o body como `JSON.stringify(body.campaign_data || {})`. Como `campaign_data` não é enviado, o PATCH vai com `{}` — nada é atualizado.

### 2. Agentes não vinculam — possível formato incorreto
O proxy envia `{ users: body.agent_ids }`. A API 3CPlus pode esperar `{ users: [id1, id2] }` (array de IDs numéricos) — isso parece correto, mas precisamos verificar se os IDs estão sendo enviados como números. Além disso, não há feedback de erro visível — o `catch` mostra apenas um `toast.warning` genérico.

### 3. Sem opção de vincular/desvincular agentes em campanha existente
A aba "Agentes" da campanha expandida só lista — não tem botões para adicionar ou remover agentes.

## Correções

### 1. `supabase/functions/threecplus-proxy/index.ts` — Fix `update_campaign`
Mudar a construção do body para capturar campos individuais como `aggressiveness`, `name`, `start_time`, `end_time` além de `campaign_data`:

```typescript
case 'update_campaign': {
  const { campaign_id, campaign_data, ...rest } = body;
  // Merge campaign_data with individual fields
  const updatePayload = { ...(campaign_data || {}), ...rest };
  delete updatePayload.action; delete updatePayload.domain; delete updatePayload.api_token;
  reqBody = JSON.stringify(updatePayload);
}
```

### 2. `src/components/contact-center/threecplus/CampaignsPanel.tsx` — Adicionar gestão de agentes na campanha expandida

Na aba "Agentes":
- Botão "Vincular Agentes" que abre dialog com multi-select (reutilizando a mesma UI do create)
- Botão de remover (X) ao lado de cada agente vinculado, chamando `remove_campaign_agent`
- Melhorar logs de erro no `add_agents_to_campaign` para mostrar a resposta real da API

### 3. Melhorar feedback de erros
- Nos catches, mostrar `err.message` ou resposta da API em vez de mensagens genéricas
- No `add_agents_to_campaign`, logar a resposta para debug

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Fix `update_campaign` para passar campos individuais (aggressiveness etc.) |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Adicionar botões vincular/desvincular agentes na aba Agentes da campanha expandida; melhorar feedback de erros |

