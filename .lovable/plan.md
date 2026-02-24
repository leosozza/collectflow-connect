

## Recuperacao de Senha + Admin Trocar Senha do Operador

### Escopo

Duas funcionalidades:

1. **"Esqueci minha senha"** na tela de login - envia email de recuperacao via sistema de autenticacao nativo
2. **Admin trocar senha do operador** na pagina de usuarios - botao na tabela que permite o admin definir nova senha

---

### 1. Esqueci minha senha (AuthPage)

**Arquivo:** `src/pages/AuthPage.tsx`

- Adicionar estado `isForgotPassword` (boolean)
- Quando ativo, exibir apenas o campo de email + botao "Enviar link de recuperacao"
- Chamar `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Exibir toast de sucesso: "Link de recuperacao enviado para seu email"
- Link "Voltar ao login" para retornar ao formulario normal

**Layout no modo "esqueci a senha":**
- Titulo: "Recuperar Senha"
- Subtitulo: "Digite seu email para receber o link de recuperacao"
- Campo: Email
- Botao: "Enviar link"
- Link: "Voltar ao login"

### 2. Pagina /reset-password

**Novo arquivo:** `src/pages/ResetPasswordPage.tsx`

- Rota publica (nao protegida)
- Detecta `type=recovery` no hash da URL (o Supabase redireciona com isso)
- Exibe formulario com "Nova senha" e "Confirmar senha"
- Chama `supabase.auth.updateUser({ password })` para atualizar
- Apos sucesso, redireciona para `/auth`

**Arquivo:** `src/App.tsx`
- Adicionar rota: `<Route path="/reset-password" element={<ResetPasswordPage />} />`

### 3. Admin trocar senha do operador

**Arquivo:** `src/pages/UsersPage.tsx`

- Adicionar botao "Trocar Senha" na linha de cada usuario (ao lado de Editar/Excluir)
- Ao clicar, abre um Dialog com campo de nova senha + confirmacao
- Chama edge function `create-user` (ou nova action) que usa `supabaseAdmin.auth.admin.updateUserById(userId, { password })`

**Arquivo:** `supabase/functions/create-user/index.ts`

- Adicionar suporte a `action: "update_password"` no body
- Quando `action === "update_password"`, receber `user_id` e `password`
- Verificar que o caller e admin do mesmo tenant
- Chamar `supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })`
- Retornar sucesso

**Fluxo do body:**
```text
// Criar usuario (existente):
{ full_name, email, password, ... }

// Trocar senha (novo):
{ action: "update_password", user_id: "xxx", password: "nova_senha" }
```

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/AuthPage.tsx` | Adicionar fluxo "Esqueci minha senha" |
| `src/pages/ResetPasswordPage.tsx` | Nova pagina para redefinir senha |
| `src/App.tsx` | Rota `/reset-password` |
| `src/pages/UsersPage.tsx` | Botao + Dialog para admin trocar senha |
| `supabase/functions/create-user/index.ts` | Suporte a `action: "update_password"` |

