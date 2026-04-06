

# Plano: Corrigir RLS da tabela `negociarie_cobrancas` para permitir operadores

## Problema

A política de INSERT na tabela `negociarie_cobrancas` só permite `is_tenant_admin` ou `is_super_admin`. Quando o operador Vitor tenta gerar boleto manualmente, o `saveCobranca` no frontend usa o token do usuário — e o RLS rejeita com "new row violates row-level security policy".

O mesmo problema existe nas políticas de UPDATE e DELETE.

## Correção

Alterar as políticas de INSERT e UPDATE para permitir qualquer usuário do tenant (não apenas admins), já que a geração de boletos deve ser acessível a todos os perfis.

### Migration SQL

```sql
-- DROP existing restrictive policies
DROP POLICY IF EXISTS "Tenant admins can insert negociarie cobrancas" ON public.negociarie_cobrancas;
DROP POLICY IF EXISTS "Tenant admins can update negociarie cobrancas" ON public.negociarie_cobrancas;

-- Recreate with tenant-wide access
CREATE POLICY "Tenant users can insert negociarie cobrancas"
  ON public.negociarie_cobrancas FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant users can update negociarie cobrancas"
  ON public.negociarie_cobrancas FOR UPDATE
  USING (tenant_id = get_my_tenant_id());
```

## Resumo

| Alteração | Detalhe |
|---|---|
| Migration SQL | Abrir INSERT e UPDATE de `negociarie_cobrancas` para todos os usuários do tenant |

Nenhuma alteração de código — apenas RLS.

