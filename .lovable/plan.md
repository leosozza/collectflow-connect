## Objetivo

No widget RIVO Suporte, o cliente obrigatoriamente escolhe **Suporte** ou **Financeiro** antes de enviar a primeira mensagem. Na criação de usuários da equipe RIVO (super admin), quando a função permitir atender suporte, escolhe-se quais áreas (Suporte / Financeiro / Ambos) o usuário vai cobrir — usando a tela já existente, sem nova rota.

## 1. Banco

Migração:

- `support_tickets`: nova coluna `category text NOT NULL DEFAULT 'suporte'` com check `('suporte','financeiro')`.
- Nova tabela `support_staff_categories`:
  - `user_id uuid PK`
  - `categories text[] NOT NULL DEFAULT '{suporte,financeiro}'` (valores aceitos: suporte, financeiro)
  - `updated_at timestamptz`
  - RLS: gerenciamento total para `is_super_admin(auth.uid())`; SELECT do próprio user permitido.

## 2. Widget cliente (`SupportFloatingButton.tsx`)

- Estado `category: 'suporte' | 'financeiro' | null`, persistido em localStorage da sessão.
- Empty state: saudação + dois botões grandes "Suporte" e "Financeiro" (visual do print, tokens semânticos).
- Enquanto `category === null`: input e botão Send desabilitados com placeholder "Selecione uma área para começar"; "Falar com humano" oculto.
- Ao escolher: mensagem do assistente "Você selecionou **{Categoria}**…" e libera input.
- `handleTalkToHuman`: insere `category` no `support_tickets` e prefixa subject `[Categoria] Chat de Suporte`.
- `streamAIResponse`: envia `category` no body do edge function.
- Pequeno ajuste no `SYSTEM_PROMPT` do `support-ai-chat` para considerar `category` recebida.

## 3. Criação de usuário (`src/pages/admin/AdminUsuariosPage.tsx`)

- No diálogo "Novo Usuário", adicionar bloco **"Áreas de atendimento de suporte"** (checkboxes Suporte / Financeiro), visível apenas quando `userType === 'rivo'` (Equipe RIVO). Valor default: ambos marcados.
- No `handleCreate`, após `invokeCreateUser` retornar com sucesso e `user_id`, fazer upsert em `support_staff_categories` com as áreas escolhidas. Se a edge function não retorna `user_id`, ajustar para retornar (verificar `userEdgeFunctionService` / edge correspondente — se necessário, fazer SELECT por email no `profiles` para obter o id).
- Para usuários RIVO existentes: na própria página, abaixo de "Criar Novo Usuário", adicionar pequeno painel/seção "Áreas de Atendimento – Equipe RIVO" listando os usuários RIVO com checkboxes editáveis (mesma escrita em `support_staff_categories`). Mantém tudo dentro da rota existente.

## 4. Painel super admin (`SupportAdminPage.tsx`)

- Mostrar badge da categoria em cada ticket.
- Filtro `Categoria` (Todas / Suporte / Financeiro) ao lado do filtro de status.
- Query de tickets para usuário **não-super-admin**: filtrar `.in('category', minhasCategorias)` lendo `support_staff_categories` do user logado. Super admin vê tudo.
- Sem nova aba "Operadores" — gerenciamento fica no AdminUsuariosPage.

## 5. Validação

- Cliente: input desabilitado até escolher área; "Suporte" e "Financeiro" criam ticket com `category` correto.
- Criar usuário RIVO marcando só "Suporte" → logar com ele → confirmar que tickets financeiros não aparecem.
- Editar áreas de um RIVO existente → comportamento muda imediatamente.
- Build limpo.

## Fora de escopo

- Roteamento automático/round-robin, notificações por categoria, relatórios por categoria.
