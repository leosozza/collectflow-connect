

# Plano: Permitir operadores com permissão RBAC executarem disparos em lote

## Problema

A Edge Function `send-bulk-whatsapp` (linha 140) só permite `admin` ou `super_admin`. O operador Vitor tem permissão `campanhas_whatsapp.create` no RBAC granular, mas a Edge Function não consulta essas permissões — retorna 403 e a campanha fica presa em `draft`.

## Correção

### Arquivo: `supabase/functions/send-bulk-whatsapp/index.ts`

Na validação de autorização (linhas 127-145), além de verificar o role do `tenant_users`, consultar também a tabela `role_permissions` para checar se o usuário possui a permissão `campanhas_whatsapp.create`:

```
Lógica atual (linha 140):
  if role NOT IN ('admin', 'super_admin') → 403

Nova lógica:
  if role IN ('admin', 'super_admin') → permitir
  else → consultar role_permissions para o role do usuário
    se tiver campanhas_whatsapp.create → permitir
    senão → 403
```

Isso alinha a Edge Function com o sistema RBAC que o frontend já utiliza.

## Resumo

| Arquivo | Alteração |
|---|---|
| `supabase/functions/send-bulk-whatsapp/index.ts` | Adicionar consulta ao RBAC granular além do check de admin |

