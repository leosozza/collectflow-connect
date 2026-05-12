-- 1. Tabela
create table if not exists public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  creditor_id uuid references public.credores(id) on delete cascade,
  provider text not null,
  environment text not null default 'producao',
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  callback_registered_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenant_integrations_scope_uidx
  on public.tenant_integrations (
    tenant_id,
    coalesce(creditor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    provider
  );

create index if not exists tenant_integrations_lookup_idx
  on public.tenant_integrations (tenant_id, provider, is_active);

-- 2. Trigger updated_at
drop trigger if exists trg_tenant_integrations_updated_at on public.tenant_integrations;
create trigger trg_tenant_integrations_updated_at
  before update on public.tenant_integrations
  for each row execute function public.update_updated_at_column();

-- 3. RLS
alter table public.tenant_integrations enable row level security;

drop policy if exists "no_direct_select" on public.tenant_integrations;
create policy "no_direct_select"
  on public.tenant_integrations for select
  using (false);

drop policy if exists "tenant_admin_insert" on public.tenant_integrations;
create policy "tenant_admin_insert"
  on public.tenant_integrations for insert
  to authenticated
  with check (
    tenant_id = public.get_my_tenant_id()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "tenant_admin_update" on public.tenant_integrations;
create policy "tenant_admin_update"
  on public.tenant_integrations for update
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

drop policy if exists "tenant_admin_delete" on public.tenant_integrations;
create policy "tenant_admin_delete"
  on public.tenant_integrations for delete
  to authenticated
  using (
    tenant_id = public.get_my_tenant_id()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'admin')
  );

-- 4. RPC de leitura mascarada
create or replace function public.get_my_integrations_status()
returns table (
  provider text,
  creditor_id uuid,
  environment text,
  is_active boolean,
  has_credentials boolean,
  uses_global_fallback boolean,
  client_id_masked text,
  callback_url text,
  callback_registered_at timestamptz,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ti.provider,
    ti.creditor_id,
    ti.environment,
    ti.is_active,
    (ti.config ? 'client_secret') as has_credentials,
    coalesce((ti.config->>'uses_global_fallback')::boolean, false) as uses_global_fallback,
    case
      when ti.config ? 'client_id' and length(ti.config->>'client_id') >= 6
        then left(ti.config->>'client_id', 4) || '••••' || right(ti.config->>'client_id', 2)
      when ti.config ? 'client_id'
        then '••••'
      else null
    end as client_id_masked,
    ti.config->>'callback_url' as callback_url,
    ti.callback_registered_at,
    ti.last_test_at,
    ti.last_test_ok,
    ti.last_test_message,
    ti.updated_at
  from public.tenant_integrations ti
  where ti.tenant_id = public.get_my_tenant_id();
$$;

revoke all on function public.get_my_integrations_status() from public;
grant execute on function public.get_my_integrations_status() to authenticated;

-- 5. Seed Y.BRASIL para usar fallback global do env
insert into public.tenant_integrations
  (tenant_id, provider, is_active, config, last_test_ok, last_test_at)
values (
  '39a450f8-7a40-46e5-8bc7-708da5043ec7'::uuid,
  'negociarie',
  true,
  jsonb_build_object('uses_global_fallback', true),
  true,
  now()
)
on conflict (tenant_id, coalesce(creditor_id, '00000000-0000-0000-0000-000000000000'::uuid), provider)
do nothing;