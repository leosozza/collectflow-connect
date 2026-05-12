## Tornar Negociarie configurável por qualquer tenant — sem quebrar Y.BRASIL

### Princípios de segurança que vão guiar tudo

1. **Credenciais nunca trafegam para o cliente.** O `client_secret` da Negociarie é tratado como senha: gravado uma vez, lido apenas por edge functions via `service_role`. A UI nunca lê de volta — só vê "configurado / não configurado", máscara `••••••••` e a data do último teste.
2. **Sem coluna `super_admin` em lugar nenhum.** A configuração é 100% do tenant. RLS amarra na `get_my_tenant_id()` e nas roles `admin` / `operador` da própria tenant.
3. **Y.BRASIL continua funcionando do dia 0 ao dia N.** O proxy já tem fallback para `NEGOCIARIE_CLIENT_ID` / `NEGOCIARIE_CLIENT_SECRET` (env). Esse fallback fica intacto. Em paralelo, criamos a linha do Y.BRASIL na nova tabela apontando para "uso do cofre global" — só pra ela aparecer "Conectada" no painel.
4. **Mudança incremental.** Nada é removido até a nova rota estar testada com um tenant novo de verdade.

---

### Etapa 1 — Banco: tabela `tenant_integrations`

Criar a tabela que o `negociarie-proxy` já espera (linhas 25–54). Schema enxuto e genérico (vai servir Asaas/CobCloud no futuro também):

```sql
create table public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  creditor_id uuid references public.credores(id) on delete cascade,  -- null = chave geral do tenant
  provider text not null,                  -- 'negociarie' (próximos: 'asaas', 'cobcloud'…)
  environment text not null default 'producao',  -- só 'producao' por enquanto (Negociarie não tem sandbox público)
  config jsonb not null default '{}'::jsonb,     -- { client_id, client_secret, callback_url, uses_global_fallback?: true }
  is_active boolean not null default true,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  callback_registered_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, coalesce(creditor_id, '00000000-0000-0000-0000-000000000000'::uuid), provider)
);

create index on public.tenant_integrations (tenant_id, provider, is_active);
```

Trigger padrão de `updated_at`.

#### RLS — o ponto mais delicado

Ninguém pode ler `config` direto. Política:

```sql
alter table public.tenant_integrations enable row level security;

-- DENY total de SELECT por padrão. Edge functions usam service_role e ignoram RLS.
create policy "no_direct_select"
  on public.tenant_integrations for select
  using (false);

-- INSERT/UPDATE/DELETE: só admin do próprio tenant
create policy "tenant_admin_write"
  on public.tenant_integrations for all
  to authenticated
  using (
    tenant_id = public.get_my_tenant_id()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    tenant_id = public.get_my_tenant_id()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
  );
```

Para a UI saber "está configurado / última checagem em X", criar uma **view de metadados** que só expõe colunas seguras:

```sql
create or replace function public.get_my_integrations_status()
returns table (
  provider text,
  creditor_id uuid,
  is_active boolean,
  has_credentials boolean,
  uses_global_fallback boolean,
  client_id_masked text,
  callback_url text,
  callback_registered_at timestamptz,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text
)
language sql stable security definer set search_path = public
as $$
  select
    ti.provider,
    ti.creditor_id,
    ti.is_active,
    (ti.config ? 'client_secret') as has_credentials,
    coalesce((ti.config->>'uses_global_fallback')::boolean, false) as uses_global_fallback,
    case
      when ti.config ? 'client_id'
        then left(ti.config->>'client_id', 4) || '••••' || right(ti.config->>'client_id', 2)
      else null
    end as client_id_masked,
    ti.config->>'callback_url' as callback_url,
    ti.callback_registered_at,
    ti.last_test_at,
    ti.last_test_ok,
    ti.last_test_message
  from public.tenant_integrations ti
  where ti.tenant_id = public.get_my_tenant_id();
$$;
revoke all on function public.get_my_integrations_status() from public;
grant execute on function public.get_my_integrations_status() to authenticated;
```

Resultado: o frontend chama `rpc('get_my_integrations_status')` e nunca toca `config`. O `client_secret` nunca sai do banco.

---

### Etapa 2 — Edge function nova: `negociarie-credentials`

Função dedicada para **salvar / remover** credenciais. Por quê separar? Porque o `negociarie-proxy` é um proxy de chamadas à API; misturar gestão de credenciais nele complica os logs e o controle de erro.

Endpoint único, autenticado via JWT:

```
POST /functions/v1/negociarie-credentials
body:
  { action: "save",   client_id, client_secret, creditor_id?: uuid }
  { action: "delete", creditor_id?: uuid }
  { action: "test",   creditor_id?: uuid }   // chama login na Negociarie sem persistir
```

Lógica:
- Valida JWT, pega `tenant_id` do `tenant_users`, valida role `admin`.
- `save`: faz **um teste de login real** na Negociarie antes de gravar. Se 200 → upsert na `tenant_integrations` com `is_active=true`, `last_test_ok=true`. Se falhar → erro 400 com mensagem clara, **nada é persistido**. Isso elimina "configurei e não funciona, mas a UI diz conectado".
- `test`: roda só o login, atualiza `last_test_at/ok/message`, devolve resultado.
- `delete`: marca `is_active=false` (mantém histórico) e zera `config` (não apaga a linha — preserva auditoria).

A função usa `service_role` internamente para ler/gravar `tenant_integrations`.

---

### Etapa 3 — Ajustes no `negociarie-proxy` (mínimos, retrocompatíveis)

O código atual já tem o fluxo certo (credor → tenant → env). Dois ajustes pequenos:

1. **Detectar a flag `uses_global_fallback`**: se a linha do tenant existir mas tiver essa flag, ignorar `config.client_id/secret` e ir direto pro env. Isso permite que Y.BRASIL apareça na tabela e na UI como "Conectado (cofre global)" sem duplicar credencial.
2. **Atualizar `last_test_*` quando o login falhar/funcionar dentro do `getToken`** — opcional, pode ficar pra etapa 5. Útil pra UI saber se a integração está saudável sem precisar do botão "Testar".

Nada na assinatura do proxy muda. Nenhum tenant atual quebra.

---

### Etapa 4 — UI: completar a aba `NegociarieTab`

Reorganizar a aba em **3 blocos** dentro do `IntegrationDetailLayout` já existente:

**Bloco 1 — Status** (sempre visível, lê `get_my_integrations_status`)
- "Conectado" / "Não configurado" / "Em erro"
- "Última verificação: há 3 min — OK" (ou mensagem do erro)
- Se `uses_global_fallback`: badge cinza "Usando cofre global" (só aparece pra Y.BRASIL)

**Bloco 2 — Credenciais** (só aparece se `!uses_global_fallback`)
- Input `Client ID` (com máscara `XXXX••••XX` quando já existe)
- Input `Client Secret` (sempre vazio; placeholder "deixe em branco para não alterar")
- Botão **"Salvar e testar"** → chama `negociarie-credentials` action `save`. Toast de sucesso / erro com mensagem da Negociarie.
- Botão secundário **"Testar conexão"** → action `test`.
- Botão de texto **"Remover credenciais"** (com `confirm`) → action `delete`.
- Link "Onde encontro essas credenciais?" → tooltip/popover explicando o caminho no painel Negociarie.

**Bloco 3 — Callback** (só faz sentido depois de conectado)
- Input com a URL `…/functions/v1/negociarie-callback` (read-only por padrão, com botão "copiar")
- Botão **"Registrar callback na Negociarie"** → continua chamando o `negociarie-proxy` action `atualizar-callback`. Também grava `callback_url` + `callback_registered_at` em `tenant_integrations`.
- Indicador "Callback registrado em DD/MM HH:mm".

A `NegociarieTab` antiga (`src/components/admin/integrations/NegociarieTab.tsx`, do super-admin) **fica como está e parte para ser removida** — não é referenciada por essa nova rota. Confirmar antes de deletar.

---

### Etapa 5 — Migração da Y.BRASIL (zero downtime)

Logo após a tabela existir, inserir uma única linha:

```sql
insert into public.tenant_integrations
  (tenant_id, provider, is_active, config, last_test_ok, last_test_at)
values (
  '39a450f8-7a40-46e5-8bc7-708da5043ec7',
  'negociarie',
  true,
  jsonb_build_object('uses_global_fallback', true),
  true, now()
);
```

Efeito:
- O proxy continua usando env (passo 3, item 1).
- A UI da Y.BRASIL passa a mostrar "Conectado — usando cofre global" em vez de "Não configurado".
- Quando quisermos migrar a Y.BRASIL para credencial própria, basta editar pela UI normal (a flag some no upsert).

---

### Etapa 6 — Pontos que ficam para depois (fora deste escopo)

- **Cobrança direta por credor** (UI para `creditor_id != null`). O backend já suporta. Adicionar UI dentro da própria aba, em uma seção "Credores com conta Negociarie própria", numa segunda iteração.
- **Validação de assinatura HMAC no `negociarie-callback`** — se a Negociarie expõe esse mecanismo. Hoje o callback aceita qualquer payload. Vale checar com eles antes de implementar.
- **Estender o mesmo padrão para Asaas / CobCloud** — a tabela `tenant_integrations` já é genérica; basta criar `asaas-credentials` e `cobcloud-credentials` quando for a hora.

---

### Resumo dos riscos

| Risco | Mitigação |
|---|---|
| Quebrar Y.BRASIL | Fallback para env continua intocado; flag `uses_global_fallback` mantém comportamento atual. |
| Vazamento de `client_secret` | RLS deny-all em SELECT; só edge function com service_role lê; UI usa RPC que retorna apenas metadados mascarados. |
| Tenant configurar credencial errada e UI dizer "Conectado" | `save` só persiste após teste de login bem-sucedido. |
| Conflito de unicidade | `unique(tenant_id, coalesce(creditor_id,...), provider)` impede duas linhas para o mesmo escopo. |
| Acoplamento com super-admin | Nada novo é adicionado em `super_admin`/role; a única gravação exige `profiles.role='admin'` do próprio tenant. |

---

### Pergunta antes de começar

A Negociarie tem ambiente de homologação/sandbox com URL diferente, ou o tenant testa direto no ambiente de produção dele? Se não tem sandbox, removo o campo `environment` da UI (ele continua na tabela só pra futuro) e marco tudo como `producao`.