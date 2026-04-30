## Problema identificado

Na tela do operador Vitor, ao tentar editar/apagar uma mensagem, apareceu:

> "Você só pode editar/excluir suas próprias mensagens"

Mas a mensagem **foi enviada por ele**. Investiguei o código e encontrei a causa raiz — não tem nada a ver com o tempo do WhatsApp.

### Causa raiz

A edge function `manage-chat-message` valida autoria lendo de `chat_messages.metadata`:

```ts
const sentByUserId = meta.sent_by_user_id;
const sentByProfileId = meta.sent_by_profile_id;
const isAuthor = (sentByUserId && sentByUserId === userId)
              || (sentByProfileId && profile?.id && sentByProfileId === profile.id);
```

Porém a função que envia a mensagem (`send-chat-message`) chama o RPC `ingest_channel_event` que **nunca grava** `sent_by_user_id` nem `sent_by_profile_id` no metadata. Resultado: para qualquer operador não-admin, `isAuthor` é sempre `false` → o erro "Você só pode editar/excluir suas próprias mensagens" sempre aparece, mesmo sendo o autor real.

Ou seja, hoje **somente admins conseguem editar/apagar**. Operadores comuns ficam bloqueados independentemente de tudo.

### Sobre o limite de tempo do WhatsApp

A regra de 15 minutos para edição já existe em `manage-chat-message`, com a mensagem:

> "Edição permitida apenas nos primeiros 15 minutos"

Mas o usuário nem chega nessa validação porque é barrado antes pela checagem de autoria quebrada. O texto dessa e de outras mensagens também precisa deixar explícito que o limite é imposto pelo WhatsApp.

---

## Plano de correção

### 1. Gravar o autor no metadata ao enviar (corrige o falso bloqueio)

Em `supabase/functions/send-chat-message/index.ts`, logo após o RPC `ingest_channel_event` retornar `message_id`, fazer um UPDATE em `chat_messages` mesclando no `metadata`:

```ts
{
  sent_by_user_id: userId,
  sent_by_profile_id: senderProfile?.id ?? null,
}
```

Reaproveitar o lookup de profile que já existe na seção "auto-assign" (linhas 320-326), executando-o sempre (não só quando precisa atribuir conversa) — uma única consulta a `profiles`.

### 2. Fallback retroativo para mensagens antigas

Mensagens enviadas antes desta correção não têm `sent_by_user_id`. Para não bloquear edição/exclusão delas, em `manage-chat-message`, quando metadata estiver vazio:

- Se a conversa estava `assigned_to = profile.id` no momento do envio, considerar autor.
- Como aproximação prática: se a mensagem é outbound e a conversa atualmente está atribuída ao operador, permitir.

Usar essa regra **somente quando** `sent_by_user_id` e `sent_by_profile_id` estão ambos ausentes (mensagens legadas). Mensagens novas continuam usando a checagem estrita.

### 3. Melhorar todas as mensagens de erro (deixar claro que o limite é do WhatsApp)

Ajustar em `supabase/functions/manage-chat-message/index.ts`:

| Atual | Novo |
|---|---|
| "Edição permitida apenas nos primeiros 15 minutos" | "O WhatsApp não permite editar mensagens enviadas há mais de 15 minutos." |
| "Somente mensagens de texto podem ser editadas" | "O WhatsApp permite editar apenas mensagens de texto." |
| "Mensagens com falha não podem ser editadas/excluídas" | "Mensagens que falharam no envio não podem ser editadas/excluídas." |
| "Mensagem já foi excluída para o destinatário" | "Esta mensagem já foi apagada para o destinatário." |
| "Mensagem sem ID do provider — não é possível operar" | "Não foi possível localizar esta mensagem no WhatsApp para apagar/editar." |
| "Você só pode editar/excluir suas próprias mensagens" | "Você só pode editar ou apagar mensagens que você mesmo enviou." |

Também tratar erros do provider (deleteByProvider/editByProvider) com mensagem amigável quando o WhatsApp recusar por tempo (o WhatsApp oficialmente bloqueia exclusão "para todos" após ~2 dias):

> "O WhatsApp não permitiu apagar esta mensagem. Mensagens muito antigas não podem mais ser apagadas para o destinatário."

Detectar via `httpStatus` 4xx + payload do provider mencionando tempo/expirado/old.

### 4. Validar o fluxo

- Operador Vitor envia mensagem nova → consegue editar nos 15 min e apagar.
- Após 15 min → mostra mensagem clara "O WhatsApp não permite editar mensagens enviadas há mais de 15 minutos."
- Mensagens antigas (pré-correção) → fallback permite operar.
- Mensagem de outro operador → bloqueia com texto claro de autoria.

---

## Arquivos alterados

- `supabase/functions/send-chat-message/index.ts` — gravar metadata de autor após RPC.
- `supabase/functions/manage-chat-message/index.ts` — fallback de autoria para legados + textos de erro melhorados + tratamento de erro do provider.

Sem migrações de banco.