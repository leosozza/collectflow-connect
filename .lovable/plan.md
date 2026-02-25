

## Plano: Chat de Suporte com IA Interativa + Feedback + Falar com Humano

### Problema Atual

O chat flutuante apenas salva mensagens no banco (`support_messages`) e depende de um staff humano responder via `SupportAdminPage`. O usuario envia mensagem e nao recebe resposta — nao ha interacao automatica.

### Solucao

Integrar o Lovable AI (ja configurado com `LOVABLE_API_KEY`) para responder automaticamente as perguntas do usuario no chat de suporte, usando os guias do sistema (`SupportGuidesTab`) como contexto. Alem disso, adicionar botoes de feedback (joinha cima/baixo) e opcao de "Falar com Humano".

### Mudancas Visuais

- **Tamanho do chat**: de `w-[380px] h-[500px]` para `w-[340px] h-[600px]` (mais fino e mais comprido)
- **Feedback**: apos cada resposta da IA, dois botoes (👍 👎) abaixo da mensagem
- **Falar com humano**: botao no footer do chat "Falar com humano" que cria um ticket e avisa que um atendente ira responder
- **Indicador de digitacao**: animacao de "..." enquanto a IA processa

### Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/support-ai-chat/index.ts` | NOVO — Edge function que recebe a pergunta do usuario, envia para Lovable AI com contexto dos guias do sistema, e retorna resposta via streaming |
| `src/components/support/SupportFloatingButton.tsx` | MODIFICAR — Integrar chamada a IA, feedback, falar com humano, novo tamanho |
| `supabase/config.toml` | MODIFICAR — Registrar `support-ai-chat` |

### Detalhes Tecnicos

#### 1. Edge Function `support-ai-chat`

- Recebe `{ message, history }` (mensagem do usuario + historico recente)
- System prompt inclui TODOS os guias do `SupportGuidesTab` como contexto (hardcoded na function)
- Usa `google/gemini-3-flash-preview` via Lovable AI Gateway
- Resposta via streaming SSE para exibicao progressiva
- Trata erros 429/402

System prompt:
```
Voce e o assistente RIVO Suporte. Responda perguntas sobre o sistema RIVO de cobranca.
Use as informacoes dos guias abaixo para responder. Se nao souber, diga que nao tem essa informacao e sugira falar com um atendente humano.
Responda de forma curta e objetiva em portugues brasileiro.

[conteudo completo dos guias do SupportGuidesTab]
```

#### 2. SupportFloatingButton — Mudancas

**Fluxo novo:**
1. Usuario digita pergunta
2. Mensagem do usuario aparece no chat (local, sem salvar no banco ainda)
3. Chamada streaming para `support-ai-chat`
4. Resposta da IA aparece progressivamente
5. Apos resposta completa, botoes 👍 👎 aparecem abaixo
6. Se usuario clica "Falar com humano": cria ticket no banco, muda modo para chat humano (comportamento atual)

**Estado local vs banco:**
- Mensagens da IA ficam em estado local (nao salvas como `support_messages`)
- Apenas quando o usuario pede "falar com humano", um ticket e criado e as mensagens passam a ser salvas no banco

**Dimensoes:** `w-[340px]` e `style={{ height: 600 }}`

**Footer atualizado:**
```
[input de texto] [enviar]
Falar com humano
O RIVO pode cometer erros.
```

**Feedback (thumbs):**
- Apenas visual por enquanto (estado local `rated` por mensagem)
- Botoes desabilitados apos clicar

#### 3. config.toml

Adicionar:
```toml
[functions.support-ai-chat]
verify_jwt = false
```

### Layout Final

```text
+----------------------------------+
| ✨ RIVO Suporte           [▼]   |
+----------------------------------+
|                                  |
|   Ola! Como posso te ajudar?     |
|                                  |
|          "Como importar?" [user] |
|                                  |
| ✨ RIVO Suporte                  |
| Para importar clientes, va em    |
| Carteira > Importar...           |
|   👍 👎                          |
|                                  |
+----------------------------------+
| Pergunte algo ao RIVO...    [↑]  |
| 💬 Falar com humano              |
| O RIVO pode cometer erros.       |
+----------------------------------+
```

