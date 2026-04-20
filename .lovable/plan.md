

## Por que as fotos ainda não aparecem

Diagnóstico no banco:

| Coluna | Valor real | Esperado pela edge atual |
|---|---|---|
| `provider` | `"evolution"` | (não usado) |
| `provider_category` | `"unofficial"` | `"evolution"` ou `"unofficial_evolution"` |

A edge `whatsapp-fetch-avatar` filtra por `provider_category` igual a `"evolution"`/`"unofficial_evolution"`/`"wuzapi"`/`"unofficial_wuzapi"`. Como **todas** as instâncias do tenant têm `provider_category = "unofficial"`, **nenhum branch executa** e a função retorna `url: null` para todas as conversas → a UI segue mostrando iniciais.

Adicionalmente, a edge usa `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` (secrets globais), mas as instâncias do tenant têm `instance_url` próprio (`https://evolution.ybrasil.com.br`) e `api_key` por instância. Mesmo que o filtro fosse corrigido, ela tentaria bater no host errado.

### Mudanças

**`supabase/functions/whatsapp-fetch-avatar/index.ts`**

1. Carregar também as colunas `provider`, `instance_url`, `api_key` (já carrega) e usar **`provider`** como discriminador, com fallback para `provider_category`:
   ```ts
   const kind = (inst.provider || inst.provider_category || "").toLowerCase();
   ```
   - Se `kind` contém `"evolution"` → branch Evolution.
   - Se `kind` contém `"wuzapi"` → branch Wuzapi.
   - Se `kind` contém `"gupshup"` ou `"official"` → pula (não suportado).

2. **Branch Evolution** — preferir credenciais da instância sobre as globais:
   ```ts
   const baseUrl = (inst.instance_url || EVOLUTION_API_URL_GLOBAL).replace(/\/+$/, "");
   const apiKey  = inst.api_key || EVOLUTION_API_KEY_GLOBAL;
   ```
   Manter o `POST /chat/fetchProfilePictureUrl/{instance_name}` com `{ number: remote_phone }`.

3. Logar de forma estruturada no início e ao final de cada conversa processada para que a falha real apareça em `edge_function_logs`:
   ```ts
   console.log("[avatar] conv", conv.id, "kind=", kind, "host=", baseUrl);
   console.log("[avatar] result", conv.id, "status=", resp.status, "url=", avatarUrl);
   ```

4. Persistir `remote_avatar_fetched_at` mesmo em falha de rede (já faz), mas **não** persistir o timestamp se o erro for "rede caiu" (status 5xx) — assim a próxima visualização da conversa tenta de novo em vez de esperar 7 dias. Regra: só grava `fetched_at` se a chamada HTTP retornou (mesmo que sem URL) ou se a categoria não for suportada.

**`src/hooks/useConversationAvatars.ts`**

5. Forçar nova tentativa após o deploy: ignorar o cache `requestedRef` para conversas cujo `remote_avatar_fetched_at` ainda é `null`. Já está assim — basta limpar o `requestedRef` quando o usuário troca de filtro/aba (já remonta o componente, então sem alteração extra necessária).

### Validação após deploy

1. Abrir a aba **Conversas** do WhatsApp.
2. Em ~1 segundo, verificar nas requests que `whatsapp-fetch-avatar` retorna `results: { <id>: { url: "https://...", cached: false } }`.
3. Avatares passam a aparecer em conversas Evolution; conversas Gupshup oficial mantêm iniciais.
4. Recarregar: avatares vêm do cache da tabela (`remote_avatar_url` populado), instantâneos.
5. Conferir `edge_function_logs` de `whatsapp-fetch-avatar` — deve haver entradas `[avatar] conv ... host=https://evolution.ybrasil.com.br ... status=200`.

Sem alterações de schema, sem migrações, sem novos secrets — só a edge function + um pequeno ajuste no hook é opcional.

