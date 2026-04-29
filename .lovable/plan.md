## Diagnóstico do erro "Edge Function returned a non-2xx status code" ao apagar mensagem WhatsApp

### Causa raiz
O backend (`manage-chat-message`) está funcionando corretamente — ele retorna respostas com mensagens claras de erro como:
- `400 — "Somente mensagens enviadas podem ser editadas/excluídas"`
- `400 — "Mensagem já foi excluída para o destinatário"`
- `403 — "Você só pode editar/excluir suas próprias mensagens"`
- `502 — "Falha no provider"` (timeout do WhatsApp / token inválido / mensagem antiga > 7 dias)

**O problema é no frontend**: quando uma edge function retorna não-2xx, o Supabase SDK v2 expõe um `error` genérico com mensagem fixa **"Edge Function returned a non-2xx status code"** e **não** popula `data` com o body do erro. A mensagem real fica escondida em `error.context.response`.

O código atual em `src/services/conversationService.ts`:

```ts
if (error) throw new Error(error.message || "Erro ao excluir mensagem");
if (data?.error) throw new Error(data.error);
```

→ A primeira linha sempre dispara primeiro com o texto genérico, e o toast no `ChatMessage.tsx` exibe exatamente o que o usuário vê na captura de tela.

### Fix proposto
Adicionar um helper `extractFunctionError` em `src/services/conversationService.ts` que lê o body real da resposta via `error.context.response.json()` (API exposta pelo `FunctionsHttpError`). Aplicá-lo em `deleteChatMessageForRecipient` e `editChatMessage`.

```ts
async function extractFunctionError(error, data, fallback) {
  if (data?.error) return String(data.error);
  const resp = error?.context?.response;
  if (resp) {
    const body = await resp.clone().json().catch(() => null);
    if (body?.error) return String(body.error);
  }
  return error?.message || fallback;
}
```

Resultado esperado: ao tentar apagar uma mensagem, o usuário verá o motivo real, ex.:
- "Mensagem já foi excluída para o destinatário"
- "Você só pode excluir suas próprias mensagens"
- "Falha no provider: HTTP 404" (mensagem antiga demais para o WhatsApp revogar)

### Próximo passo após aplicar o fix
Você tenta apagar a mensagem novamente e me manda o **novo texto do toast**. Aí vamos saber se é uma regra de negócio (autoria/idade) ou uma falha real na integração com a Evolution/Gupshup/WuzAPI — e nesse segundo caso eu olho `deleteByProvider` no `whatsapp-sender.ts`.

### Arquivos a editar
- `src/services/conversationService.ts` — adicionar helper + ajustar `deleteChatMessageForRecipient` e `editChatMessage`

### Não faremos agora
- Não vamos mudar nada na edge function (`manage-chat-message`) — ela está correta
- Não vamos suprimir o erro: queremos que o usuário (e nós) vejamos o motivo real

Posso aplicar?