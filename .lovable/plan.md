

## Renderizar formatação estilo WhatsApp nas mensagens do chat

Hoje o conteúdo da mensagem é renderizado como texto puro em `ChatMessage.tsx` (linhas 70, 119, 157, 169 e o preview de reply em 213–214). Os caracteres `*`, `_`, `~` e ` ``` ` aparecem literais — sem virar negrito/itálico/etc.

### Padrão WhatsApp a suportar

| Sintaxe | Resultado |
|---|---|
| `*texto*` | **negrito** |
| `_texto_` | *itálico* |
| `~texto~` | ~~tachado~~ |
| `` `texto` `` ou ` ``` `bloco` ``` ` | `monoespaçado` |
| `> citação` (no início da linha) | bloco de citação com barra lateral |
| URLs (`https://…`, `www.…`) | link clicável azul |
| `\n` | quebra de linha (já funciona via `whitespace-pre-wrap`) |

Regras-chave do WhatsApp (replicar fielmente):
- Marcadores só viram formatação se delimitarem texto real e tiverem **fronteiras de palavra** (não dentro de `foo*bar*baz`).
- Aceitam aninhamento simples (`*_negrito itálico_*`).
- Se não houver marcador de fechamento, exibir literal.
- Não interpretar dentro de bloco de código (` ``` ` ou `` ` ``).

### Mudanças

**1. Novo helper `src/lib/whatsappFormat.tsx`**

Função pura `formatWhatsAppText(text: string): React.ReactNode[]` que:
- Faz parse linha a linha; identifica `>` como citação.
- Processa code blocks ` ``` ` primeiro (preservando conteúdo intacto), depois inline code `` ` ``.
- Aplica regex com lookbehind/lookahead para `*`, `_`, `~`:
  - `(?<=^|[\s(])\*([^*\n]+?)\*(?=$|[\s.,!?)])` etc.
- Detecta URLs (`https?://…` e `www\.…`) e renderiza `<a target="_blank" rel="noopener noreferrer">`.
- Faz escape implícito (não usa `dangerouslySetInnerHTML`) — retorna `<strong>`, `<em>`, `<s>`, `<code>`, `<blockquote>`, `<a>` aninháveis.
- Devolve `React.ReactNode[]` para inserir direto em `<p>`.

Tipografia/cores compatíveis com a bolha:
- `<strong>` → `font-semibold`
- `<em>` → `italic`
- `<s>` → `line-through opacity-80`
- `<code>` → `font-mono text-[13px] bg-black/5 dark:bg-white/10 px-1 rounded`
- bloco de código → `block bg-black/5 dark:bg-white/10 px-2 py-1 rounded my-1 whitespace-pre-wrap`
- `<blockquote>` → `border-l-[3px] border-current/40 pl-2 opacity-85 my-0.5`
- `<a>` → `underline text-[#027eb5] dark:text-[#53bdeb] break-all`

**2. `src/components/contact-center/whatsapp/ChatMessage.tsx`**

Substituir todas as renderizações de texto puro por `formatWhatsAppText(...)`:
- Linha 70 (caption de imagem)
- Linha 119 (caption de vídeo)
- Linha 157 (texto padrão da mensagem) — manter `whitespace-pre-wrap break-words`
- Linha 169 (nota interna) — também aplicar
- Linhas 213–214 (preview de mensagem respondida) — aplicar com `line-clamp-2`

A transcrição de áudio (linha 99) **não** recebe formatação (é texto gerado por IA, sem marcadores).

**3. Aplicar nos demais pontos de exibição de mensagens**

- `src/components/atendimento/WhatsAppChat.tsx` (linha 39 — `msg.message_body`).
- Verificar também `WhatsAppChatLayout` e qualquer preview de "última mensagem" na lista de conversas: **manter texto puro** lá (lista compacta), apenas remover os marcadores visualmente com um `stripWhatsAppMarkers(text)` auxiliar — para o preview ficar limpo sem mostrar `*`/`_`.

### Validação

1. Cliente envia `*Olá* _tudo bem?_` → bolha mostra **Olá** *tudo bem?*; nenhum `*` ou `_` literal.
2. Operador envia ` ```js\nconsole.log(1)\n``` ` → bloco monoespaçado com fundo escuro.
3. Mensagem `> não esqueça do prazo` → linha com barra lateral (citação).
4. URL `https://rivoconnect.com` vira link clicável (abre em nova aba).
5. Marcador desbalanceado: `Custa R$ 5*` → exibe literal `Custa R$ 5*` (sem virar negrito).
6. Aninhamento `*_negrito e itálico_*` → renderiza ambos.
7. Preview de "responder" e lista de conversas mostram o texto **sem** os marcadores `*`/`_`/`~` (limpo).
8. Quebras de linha (`\n`) continuam preservadas.
9. Nota interna (amarela) também aplica formatação.
10. Performance: lista com 200 mensagens não trava (regex linear, sem re-render extra).

### Fora de escopo

- Emojis customizados / reactions (já tratados separadamente).
- Mentions (`@5511…`) — WhatsApp Business API não envia para chats individuais.
- Editor rich-text no `ChatInput` (continua texto puro; o operador digita os marcadores manualmente, idêntico ao app oficial).

