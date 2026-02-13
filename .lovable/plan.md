

# Convite por Link + Perfil do Operador + Avatar no Header

## Resumo

Tres funcionalidades interligadas: (1) convite de novos usuarios por link na pagina /usuarios, (2) pagina de perfil para cada operador com foto, dados, aniversario e gamificacao, (3) header mostrando avatar e nome do usuario logado, clicavel para abrir o perfil.

---

## 1. Alteracoes no Banco de Dados

### Novos campos na tabela `profiles`
- `avatar_url` (text, nullable) -- URL da foto do perfil
- `birthday` (date, nullable) -- data de aniversario
- `bio` (text, nullable) -- breve descricao

### Nova tabela `invite_links`
- `id` (uuid, PK)
- `tenant_id` (uuid, NOT NULL)
- `token` (text, UNIQUE, NOT NULL) -- token unico do convite
- `role` (tenant_role, default 'operador')
- `created_by` (uuid, NOT NULL)
- `expires_at` (timestamptz, NOT NULL) -- expiracao do link
- `used_by` (uuid, nullable) -- preenchido quando aceito
- `used_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())

RLS: admins do tenant podem criar/ver, service_role acesso total para o fluxo de aceite.

### Nova tabela `achievements` (conquistas/gamificacao)
- `id` (uuid, PK)
- `tenant_id` (uuid, NOT NULL)
- `profile_id` (uuid, NOT NULL)
- `title` (text, NOT NULL) -- ex: "Primeiro Acordo", "100 Acordos"
- `description` (text)
- `icon` (text) -- emoji ou nome de icone
- `earned_at` (timestamptz, default now())

RLS: usuarios do tenant podem ver, admins podem gerenciar.

---

## 2. Convite por Link (`/usuarios`)

### Fluxo
1. Admin clica em "Convidar por Link"
2. Dialog abre com opcao de selecionar role (operador/admin) e validade (24h, 7 dias, 30 dias)
3. Sistema gera token unico, salva na tabela `invite_links`, e monta URL: `{origin}/auth?invite={token}`
4. Admin copia o link e envia ao convidado
5. Convidado acessa o link, tela de cadastro ja vem preenchida com contexto do convite
6. Ao fazer signup, o sistema associa o novo usuario ao tenant correto via o token

### Mudancas em arquivos
- **`src/pages/UsersPage.tsx`**: Adicionar botao "Convidar por Link" + dialog de geracao
- **`src/pages/AuthPage.tsx`**: Detectar query param `invite`, buscar dados do convite, apos signup vincular ao tenant
- **Edge function ou trigger**: Ao criar conta com invite valido, inserir em `tenant_users` e atualizar `profiles.tenant_id`

---

## 3. Pagina de Perfil (`/perfil` e `/perfil/:id`)

### Nova pagina `src/pages/PerfilPage.tsx`

Layout com:
- **Header do perfil**: Avatar grande (upload de foto), nome, role, bio editavel
- **Dados pessoais**: Aniversario, email, data de entrada
- **Estatisticas**: Total de acordos fechados, valor total negociado, taxa de conversao
- **Conquistas/Gamificacao**: Grid de badges/conquistas com icones
  - Exemplos: "Primeiro Acordo", "10 Acordos no Mes", "Top Negociador"
- **Atividade recente**: Ultimas acoes do operador

Operadores podem editar seu proprio perfil (nome, avatar, bio, aniversario).
Admins podem ver o perfil de qualquer operador.

### Rota
- `/perfil` -- perfil do usuario logado
- `/perfil/:userId` -- perfil de outro usuario (admin only)

---

## 4. Avatar e Nome no Header

### Mudanca em `src/components/AppLayout.tsx`

Substituir o texto "Super Admin" / "Administrador" / "Operador" no header por:
- Avatar circular (componente Avatar com fallback de iniciais)
- Nome do usuario
- Badge do role (pequeno, sutil)
- Ao clicar, navega para `/perfil`

---

## 5. Storage para Avatares

Criar bucket `avatars` (publico) para armazenar fotos de perfil dos usuarios.

---

## Detalhes Tecnicos

### Tabela invite_links - SQL

```text
CREATE TABLE public.invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  role tenant_role NOT NULL DEFAULT 'operador',
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;
```

### Fluxo de aceite do convite na AuthPage

1. Detectar `?invite=TOKEN` na URL
2. Buscar invite_link pelo token (RLS permite leitura publica para tokens validos)
3. Mostrar nome do tenant no formulario de cadastro
4. Apos signup bem-sucedido, chamar edge function `accept-invite` que:
   - Valida token (nao expirado, nao usado)
   - Insere em `tenant_users`
   - Atualiza `profiles.tenant_id`
   - Marca invite como usado

### Upload de Avatar

Usar Supabase Storage com bucket `avatars`. O upload acontece no componente de perfil, salvando a URL publica em `profiles.avatar_url`.

### Gamificacao - Logica inicial

Conquistas serao inseridas por triggers ou chamadas manuais baseadas em marcos:
- Acordo criado (1o, 10o, 50o, 100o)
- Valor total negociado (R$10k, R$50k, R$100k)
- Dias consecutivos de atividade

### Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar campos em profiles, tabelas invite_links e achievements, bucket avatars |
| `src/pages/PerfilPage.tsx` | **Novo** - Pagina de perfil completa |
| `src/pages/UsersPage.tsx` | Adicionar botao e dialog de convite por link |
| `src/pages/AuthPage.tsx` | Detectar invite token e fluxo de aceite |
| `src/components/AppLayout.tsx` | Avatar + nome clicavel no header |
| `src/App.tsx` | Adicionar rotas /perfil e /perfil/:userId |
| `supabase/functions/accept-invite/index.ts` | **Novo** - Edge function para aceitar convite |

