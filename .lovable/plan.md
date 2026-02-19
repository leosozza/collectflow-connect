
## Correção: Erro de Validação no Click2Call (3CPlus)

### Causa Raiz Identificada

Os logs da função de backend confirmam que a API do 3CPlus retorna HTTP 422 no endpoint `click2call`. O erro "Erros de validação foram encontrados ao processar sua requisição" é a mensagem padrão do 3CPlus para payloads com tipos de dados incorretos.

O problema está no proxy `threecplus-proxy/index.ts`, na case `click2call`:

```javascript
// ATUAL (incorreto)
reqBody = JSON.stringify({ agent_id: body.agent_id, phone_number: body.phone_number });
```

O campo `agent_id` é enviado como string (o JSON não distingue quando vem do banco como texto), mas a API do 3CPlus exige que seja um **integer**. Isso causa a rejeição 422.

Há também uma segunda causa possível: o numero de telefone pode não estar no formato correto que o 3CPlus espera (com DDI +55 ou sem ele).

### Arquivos a Modificar

Apenas 1 arquivo:
- `supabase/functions/threecplus-proxy/index.ts` - case `click2call`

### Correções

**1. Garantir `agent_id` como Number**

```javascript
case 'click2call': {
  if (!body.agent_id || !body.phone_number) { ... }
  url = buildUrl(baseUrl, 'click2call', authParam);
  method = 'POST';
  // Converter agent_id para number - a API 3CPlus exige integer
  const agentIdNum = Number(body.agent_id);
  reqBody = JSON.stringify({ 
    agent_id: agentIdNum, 
    phone_number: body.phone_number 
  });
  break;
}
```

**2. Melhorar tratamento de erro 422**

Atualmente o frontend recebe o corpo da resposta 422 mas o `AtendimentoPage` só verifica `data?.status >= 400`. Melhorar para exibir a mensagem de detalhe da API em vez da mensagem genérica.

```javascript
// Em AtendimentoPage.tsx - handleCall
if (data?.status && data.status >= 400) {
  // Extrair mensagem mais detalhada do 3CPlus
  const detail = data.detail || data.message || data.errors?.[0] || "Erro ao discar";
  toast.error(detail);
}
```

**3. Log adicional para debugging**

Adicionar log do payload exato enviado ao 3CPlus para facilitar diagnósticos futuros:

```javascript
console.log(`click2call payload: agent_id=${agentIdNum} (${typeof agentIdNum}), phone=${body.phone_number}`);
```

### Fluxo Corrigido

```text
AtendimentoPage
  → handleCall(phone)
  → supabase.functions.invoke("threecplus-proxy", {
      agent_id: profile.threecplus_agent_id,  // string do banco
      phone_number: "11912345678"
    })

threecplus-proxy (fix)
  → agent_id: Number(body.agent_id)  // converte para integer
  → POST /api/v1/click2call
  → { agent_id: 12345, phone_number: "11912345678" }  // integer correto

3CPlus API
  → HTTP 200 (sucesso)
```

### Por que não é um problema de rota/configuração

O domínio e token estão corretos (outras chamadas como `agents_status`, `list_campaigns` retornam 200 com sucesso). O problema é exclusivamente o tipo do `agent_id` no payload do click2call.
