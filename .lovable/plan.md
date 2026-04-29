## Diagnosticar e corrigir erro ao editar mensagem do WhatsApp

O toast mostra apenas `"Edge Function returned a non-2xx status code"`, que é a mensagem genérica do SDK do Supabase quando a edge function retorna 4xx/5xx. **Essa mensagem não é o erro real** — ela esconde a causa.

Os logs mais recentes da função `manage-chat-message` só mostram `shutdown` (sem `[manage-chat-message] fatal`, sem chamadas de `console.error`), e o analytics não retornou execuções dela na última hora — ou seja, ou ela está respondendo com erro **antes** de qualquer log custom (pouco provável), ou o front está engolindo o erro sem expor o `body.error` retornado pela função.

### Causas prováveis (ordenadas)

1. **Evolution `/chat/updateMessage/{instance}` retornou erro** (HTTP 400/500) — comum quando:
   - A mensagem original tem mais de 15 minutos no WhatsApp (mesmo passando na nossa checagem de 15 min em `created_at`, o WhatsApp pode rejeitar).
   - O `provider_message_id`/`external_id` da mensagem foi gravado com formato diferente do esperado pela Evolution (ex.: prefix de remoteJid, JID com sufixo `_alt`).
   - A instância está em `connecting`/desconectada.
2. **Mensagem é `template/interactive`** mas marcada como `text`, ou foi enviada via **Gupshup** (oficial) — `editByProvider` retorna explicitamente "Edição de mensagem não é suportada pela API oficial (Gupshup/Meta).". O texto `Ok` cabe nas duas hipóteses.
3. **`extractFunctionError` no front falha** ao ler `error.context.response` (o SDK do Supabase nem sempre expõe `clone()` corretamente para erros HTTP), então o usuário só vê a string genérica.

### Mudanças

1. **Frontend — exibir o erro real (`src/services/conversationService.ts`)**
   - Refatorar `extractFunctionError` para aguardar `error?.context?.text()` / `error?.context?.json()` (formato moderno do `FunctionsHttpError`) **antes** de cair no `error.message`.
   - Tentar nesta ordem: `data.error` → `error.context.json()` (resp body como JSON) → `error.context.text()` → `error.message` → fallback.
   - Resultado: o toast passa a mostrar exatamente o motivo (ex.: "Edição permitida apenas nos primeiros 15 minutos", "Edição não suportada pela API oficial", "HTTP 400 do provider", etc.).

2. **Edge function — logs detalhados (`supabase/functions/manage-chat-message/index.ts`)**
   - Adicionar `console.log("[manage-chat-message] start", { messageId, action })` no início.
   - Logar o resultado do provider em caso de falha: `console.error("[manage-chat-message] provider error", { provider, error, providerMessageId })`.
   - Logar `console.log("[manage-chat-message] success", { provider, action })` ao final.
   - Assim conseguimos ver no painel de logs o que a Evolution respondeu na próxima tentativa.

3. **Edge function — incluir status HTTP do provider no payload de erro (`_shared/whatsapp-sender.ts`)**
   - Em `editByProvider`, anexar `httpStatus` ao retorno em caso de erro Evolution/WuzAPI: `{ ok: false, error, httpStatus: resp.status, providerBody: result }`.
   - Em `index.ts`, ao retornar 502, propagar esse contexto: `json({ error: providerResult.error, provider: providerResult.provider, httpStatus: providerResult.httpStatus, providerBody: providerResult.result }, 502)`.
   - O front (após mudança 1) vai exibir esse JSON ou string.

4. **UI — desativar botão "Editar" quando provider é Gupshup (oficial)**
   - Em `src/components/contact-center/whatsapp/ChatMessage.tsx`, na flag `canEdit`, considerar a propriedade do provider da conversa/instância (já temos no contexto). Se for Gupshup, esconder a opção do menu e o ícone de edição, evitando o erro.
   - Se a info de provider não está disponível ali, expor via `useConversationContext`/prop e propagar.

### Resultado esperado

- Próxima tentativa: o usuário verá no toast uma mensagem real (ex.: `"WhatsApp respondeu HTTP 400: messageId expired"` ou similar), e teremos logs de servidor para fechar o diagnóstico.
- Se a causa for Gupshup, a opção nem aparece mais no menu.
- Se a causa for Evolution recusando a edição, fica claro qual o motivo (janela do WhatsApp, JID inválido, instância offline) e pode ser tratado pontualmente.

### Fora de escopo
- Não vamos mudar o limite de 15 min (já é regra do produto).
- Não vamos implementar uma forma alternativa de "edição" (envio de nova mensagem citando) sem o usuário pedir.
