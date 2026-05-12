## Objetivo

Ajustar o fluxo de fechar/minimizar do widget de suporte e adicionar histórico das 10 últimas conversas com a IA.

## Mudanças

### 1. Distinguir "minimizar" de "fechar" — `SupportFloatingButton.tsx`

Hoje existem dois pontos de saída e ambos resetam tudo:
- Setinha (ChevronDown) no header
- Botão X no FAB (quando o painel está aberto)

Novo comportamento:

- **Setinha no header (minimizar)**: apenas fecha o painel (`setOpen(false)`). NÃO reseta `category` nem `messages`. Ao reabrir, o usuário continua de onde parou.
- **X no FAB (fechar atendimento)**: 
  - Se há atendimento em andamento (`category !== null` ou `messages.length > 0`), abrir um `AlertDialog` com aviso:  
    *"Ao fechar, sua conversa atual será encerrada e iniciada do zero na próxima abertura. Deseja continuar?"*  
    Botões: "Cancelar" / "Encerrar atendimento".
  - Se não há atendimento (estado limpo), fecha sem perguntar.
  - Antes de resetar, **salvar a conversa no histórico** (se houver mensagens).

### 2. Histórico das 10 últimas conversas

Nova tabela `support_ai_conversations`:
- `id uuid pk`, `tenant_id uuid`, `user_id uuid`, `category text`, `title text` (gerado a partir da 1ª mensagem do usuário, truncada), `messages jsonb` (array `{role, content}`), `created_at timestamptz`.
- RLS: usuário lê/insere/deleta apenas as próprias (`user_id = auth.uid()`), com `tenant_id = get_my_tenant_id()`.
- Função/trigger não necessários — manter limpeza no client: ao inserir, apagar conversas excedentes além das 10 mais recentes do usuário.

Persistência:
- Ao confirmar fechar atendimento (X) **com mensagens**, gravar uma nova linha.
- Após inserir, deletar as antigas mantendo apenas top 10 (`order by created_at desc`).

### 3. Botão "Histórico" no header do painel

- Novo botão pequeno no header (lado esquerdo do ChevronDown) com ícone (History) + label "Histórico".
- Ao clicar, abre um overlay/Sheet interno do próprio painel listando as 10 últimas conversas:
  - Cada item: badge da categoria, título (1ª pergunta), data relativa.
  - Clicar carrega as mensagens em modo somente-leitura (banner: "Conversa anterior — somente leitura. Para nova dúvida, clique em Voltar").
  - Botão "Voltar" retorna ao chat ativo (sem reset).
  - Botão lixeira por item para remover.

### 4. Fora de escopo

- Não mexer no fluxo humano (`support_tickets`/`support_messages`).
- Não mexer na edge `support-ai-chat`.
- Não mexer no painel admin de suporte.

## Detalhes técnicos

Arquivos:
- `src/components/support/SupportFloatingButton.tsx` — separar `handleMinimize` (não reseta) de `handleCloseConversation` (com `AlertDialog`); adicionar estado `historyOpen`, `viewingConversation`; salvar no DB ao encerrar.
- Novo `src/components/support/SupportHistoryPanel.tsx` — lista + viewer de conversa antiga, montado dentro do painel quando `historyOpen`.
- Nova migration: tabela `support_ai_conversations` + RLS.

SQL (resumo):
```sql
create table public.support_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  category text not null check (category in ('suporte','financeiro')),
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.support_ai_conversations enable row level security;
create policy "user_select_own" on public.support_ai_conversations
  for select using (user_id = auth.uid() and tenant_id = public.get_my_tenant_id());
create policy "user_insert_own" on public.support_ai_conversations
  for insert with check (user_id = auth.uid() and tenant_id = public.get_my_tenant_id());
create policy "user_delete_own" on public.support_ai_conversations
  for delete using (user_id = auth.uid());
create index on public.support_ai_conversations (user_id, created_at desc);
```

Limpeza top-10 no client após insert:
```ts
const { data: extras } = await supabase
  .from("support_ai_conversations")
  .select("id")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .range(10, 999);
if (extras?.length) await supabase.from("support_ai_conversations").delete().in("id", extras.map(e=>e.id));
```

UI:
- `AlertDialog` do shadcn já disponível.
- Ícone `History` do lucide-react.
- Reaproveitar tokens semânticos existentes (sem cor hardcoded).
