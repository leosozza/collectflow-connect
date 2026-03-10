

## Plano: Página de Perfil completa com Segurança e 2FA

### Problema
1. A rota `/perfil` não existe no `App.tsx` — clicar no avatar leva ao 404
2. A `PerfilPage` atual tem foto e nome, mas falta: alteração de senha, 2FA, e email de login
3. Super Admin clica no avatar e também vai para `/perfil`, que não está nas rotas do admin

### Alterações

**1. `src/App.tsx` — Registrar rotas `/perfil`**
- Adicionar rota `/perfil` dentro das rotas tenant (com `AppLayout`)
- Adicionar rota `/admin/perfil` dentro das rotas do Super Admin (com `SuperAdminLayout`)
- Ambas apontam para `PerfilPage`

**2. `src/pages/PerfilPage.tsx` — Reescrever com abas**
Reorganizar a página em tabs usando `Tabs` do Radix:

**Tab "Dados Pessoais"** (já existe parcialmente):
- Foto de perfil (upload existente)
- Nome, Bio, Aniversário

**Tab "Segurança"** (NOVA):
- **Email de login** (somente leitura, vindo de `user.email`)
- **Alterar senha**: campos senha atual não necessária (usa `supabase.auth.updateUser({ password })`)
- **Autenticação de 2 fatores (TOTP)**:
  - Botão "Ativar 2FA" → chama `supabase.auth.mfa.enroll({ factorType: 'totp' })`
  - Mostra QR code para escanear
  - Campo para digitar código de verificação → `supabase.auth.mfa.challengeAndVerify()`
  - Se já ativo, mostra botão "Desativar 2FA" → `supabase.auth.mfa.unenroll()`
- **Reset de senha**: botão que envia email de redefinição via `supabase.auth.resetPasswordForEmail()`

**3. `src/components/SuperAdminLayout.tsx`**
- Alterar o `navigate("/perfil")` para `navigate("/admin/perfil")`

### Fluxo de 2FA
1. Usuário clica "Ativar 2FA"
2. Sistema chama `mfa.enroll()` e exibe QR code TOTP
3. Usuário escaneia com Google Authenticator / Authy
4. Digita o código de 6 dígitos
5. Sistema verifica com `mfa.challengeAndVerify()` e confirma ativação

### Arquivos
- **Alterar**: `src/App.tsx` (2 rotas novas)
- **Alterar**: `src/pages/PerfilPage.tsx` (reorganizar em tabs + tab segurança)
- **Alterar**: `src/components/SuperAdminLayout.tsx` (fix navigate path)

### Sem migrations necessárias
Tudo usa APIs de autenticação existentes — sem tabelas novas.

