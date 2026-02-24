

## Otimizacoes do WhatsApp e Telefonia - Plano Detalhado

Este plano aborda 7 melhorias solicitadas, divididas entre WhatsApp e Telefonia.

---

### 1. WhatsApp - Layout 100% na tela (sem scroll externo)

**Problema**: A pagina WhatsApp tem `p-4 lg:p-6` no `<main>` do AppLayout, causando padding desnecessario e possivel scroll.

**Solucao**:
- No `ContactCenterPage`, quando o canal e WhatsApp, remover o padding do container e usar `h-[calc(100vh-4rem)]` para ocupar toda a tela
- Ajustar scrollbars para estilo "thin" discreto em `ConversationList` e `ContactSidebar`

| Arquivo | Mudanca |
|---|---|
| `src/pages/ContactCenterPage.tsx` | Wrap WhatsApp em container sem padding, height 100% |
| `src/components/AppLayout.tsx` | Condicionar padding do `<main>` para rotas de contact center (sem padding) |

---

### 2. WhatsApp - Pesquisa por Etiqueta na lista de conversas

**Problema**: O filtro atual permite busca por nome/telefone e status, mas nao por etiqueta.

**Solucao**:
- Adicionar um novo `Select` de filtro por etiqueta no header do `ConversationList`
- Carregar tags do tenant via query em `conversation_tags`
- Filtrar conversas que possuam a tag selecionada via `conversation_tag_assignments`
- Passar as tags disponiveis e assignments como props desde o `WhatsAppChatLayout`

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | Carregar tags e tag_assignments, passar como props |
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Adicionar filtro Select de etiqueta, filtrar conversas por tag |

---

### 3. WhatsApp - Notificacao no sininho para conversas em "Aguardando"

**Problema**: Quando um cliente fica em status "waiting", o operador nao recebe notificacao.

**Solucao**:
- No `WhatsAppChatLayout`, quando o realtime detectar uma conversa mudando para status `waiting`, inserir uma notificacao na tabela `notifications` para o operador atribuido (ou todos os operadores da instancia)
- O sistema de notificacoes existente (sininho + realtime) mostrara automaticamente

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | No listener realtime de conversations, ao detectar status "waiting", criar notificacao |

---

### 4. WhatsApp - Menu Admin com filtros rapidos (Aberta/Aguardando/Fechada) + Operador

**Problema**: O admin quer clicar no menu e ver rapidamente conversas por status. O operador deve ter a mesma funcionalidade.

**Solucao**:
- Adicionar pills/botoes de contagem (Aberta: X, Aguardando: X, Fechada: X) acima da lista de conversas
- Clicar em um pill aplica o filtro de status automaticamente
- Disponivel tanto para admin quanto para operador
- Remover o Select de status e usar os pills como filtro visual

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Adicionar pills de contagem por status com filtro ao clicar, substituindo o Select |

---

### 5. Telefonia - Remover DialPad (teclado numerico) da view do operador

**Problema**: O usuario informou que nao e mais necessario o aparelho com numeros para ligacoes manuais.

**Solucao**:
- Remover o componente `DialPad` da view do operador no `TelefoniaDashboard`
- Manter o card do operador ocupando toda a largura (remover o grid de 3+2 colunas)

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Remover DialPad da view operador, card em largura total |

---

### 6. Telefonia - Pausas pre-definidas para o operador

**Problema**: O operador precisa poder colocar pausas (intervalos de trabalho) direto no RIVO sem ir ao 3CPlus.

**Solucao**:
- Adicionar action `pause_agent` e `unpause_agent` no `threecplus-proxy` usando endpoints `POST /agent/pause` e `POST /agent/unpause` da API 3CPlus (usando token do agente resolvido via GET /users)
- Adicionar action `list_work_break_intervals` que ja existe no proxy para buscar os intervalos disponiveis da campanha
- No card do operador (`TelefoniaDashboard`), adicionar botao "Pausar" que abre um Popover com a lista de intervalos disponiveis (cafe, almoco, banheiro etc.)
- Ao selecionar, chamar `pause_agent` com o `interval_id`
- Quando em pausa, mostrar botao "Retomar" que chama `unpause_agent`

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar actions `pause_agent` e `unpause_agent` com resolucao de token do agente |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Adicionar botao de pausa com lista de intervalos no card do operador |

---

### 7. Telefonia - Otimizar layout admin (limpo e funcional)

**Problema**: A tela precisa ser mais limpa e bonita.

**Solucao**:
- Ajustar espacamentos e bordas no admin view
- KPIs em cards mais compactos com hover sutil
- Seção de agentes e campanhas com separadores visuais mais claros
- Garantir que tudo cabe em 100% da tela sem scroll horizontal

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Refinar visual do admin view (spacing, shadows, hover states) |

---

### Resumo de arquivos

| Arquivo | Mudancas |
|---|---|
| `src/components/AppLayout.tsx` | Remover padding para rotas de contact center |
| `src/pages/ContactCenterPage.tsx` | Ajustar container WhatsApp para fullscreen |
| `src/components/contact-center/whatsapp/ConversationList.tsx` | Pills de status + filtro por etiqueta |
| `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` | Carregar tags, notificacao "waiting" |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Remover DialPad operador, adicionar pausas, refinar layout admin |
| `supabase/functions/threecplus-proxy/index.ts` | Actions pause_agent e unpause_agent |

