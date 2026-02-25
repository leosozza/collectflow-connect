

## Plano: Corrigir erro de validacao ao entrar na campanha

### Problema Identificado

Testei a chamada `POST /agent/login` diretamente e a API 3CPlus retornou:

```json
{
  "detail": "Erros de validação foram encontrados ao processar sua requisição.",
  "errors": {
    "campaign": ["O campo Campanha é obrigatório quanto group id não está presente."],
    "group_id": ["O campo group id é obrigatório quanto Campanha não está presente."]
  },
  "status": 422
}
```

**Causa raiz**: No proxy, linha 569, o body enviado ao 3CPlus usa `campaign_id`, mas a API espera o campo chamado `campaign`.

```typescript
// ERRADO (atual):
reqBody = JSON.stringify({ campaign_id: body.campaign_id });

// CORRETO:
reqBody = JSON.stringify({ campaign: body.campaign_id });
```

### Alteracao

**Arquivo: `supabase/functions/threecplus-proxy/index.ts`** (linha 569)

Mudar o nome do campo no body de `campaign_id` para `campaign`. Apenas 1 linha precisa ser alterada.

### Detalhes Tecnicos

- A API 3CPlus `POST /agent/login` aceita `campaign` (numero do ID da campanha) como campo obrigatorio, nao `campaign_id`
- Confirmado testando diretamente via curl na edge function — a resposta 422 mostra explicitamente que o campo esperado e `campaign`
- Apos a correcao, o fluxo completo (login + connect SIP) deve funcionar normalmente

