
## Correção: Criar Profile Faltante para Maria Eduarda

### Problema Identificado

A usuária `madusousa070@gmail.com` (Maria Eduarda De Sousa Torres) possui:
- Conta de autenticação ativa e confirmada desde 06/02/2026
- Registro em `tenant_users` com role `operador` no tenant `39a450f8`
- **Ausência total de registro na tabela `profiles`** — o que faz ela ser invisível para todos os listagens do sistema

O trigger `handle_new_user` que deveria criar automaticamente o profile no momento do cadastro não funcionou para ela (provavelmente foi adicionada via outra rota, como convite manual sem o fluxo normal).

### Correção via Migração SQL

Será criada uma migração cirúrgica que insere o registro faltante em `profiles` para ela:

```sql
INSERT INTO public.profiles (user_id, full_name, role, tenant_id)
VALUES (
  '64853b95-8200-46a3-9387-9e7d685eb476',
  'Maria Eduarda De Sousa Torres',
  'operador',
  '39a450f8-7a40-46e5-8bc7-708da5043ec7'
)
ON CONFLICT (user_id) DO NOTHING;
```

O `ON CONFLICT DO NOTHING` garante que, se por algum motivo o registro já existir, a migração não causará erro.

### Melhoria Preventiva: Trigger Mais Robusto

Para evitar que isso aconteça com futuros usuários adicionados via convite ou outras rotas, será adicionada uma verificação extra na edge function `create-user` que já existe: caso o profile não seja encontrado após a criação (`UPDATE` retornar 0 linhas), ela fará um `INSERT` direto em vez de apenas um UPDATE.

Isso garante que mesmo se o trigger falhar, a edge function cobre o caso.

### Arquivos a Modificar

| Arquivo | Tipo | Mudança |
|---|---|---|
| Nova migração SQL | SQL | Inserir profile faltante de Maria Eduarda |
| `supabase/functions/create-user/index.ts` | Edge Function | Usar `upsert` em vez de `update` para profiles, garantindo criação mesmo se trigger falhou |

### Resultado Esperado

Após a migração:
- Maria Eduarda aparecerá na listagem de usuários em Cadastros
- O Admin poderá vincular um Perfil de Permissão a ela
- Ela poderá ser visualizada, editada e gerenciada normalmente
