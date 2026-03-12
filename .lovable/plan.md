

# Plano: Corrigir integração Target Data (IP + JWT webhook)

## Problemas encontrados

### 1. Edge Function `targetdata-enrich` — IP não autorizado
O último log mostra:
```
{"code_error":1099,"message_error":"IP não autorizado"}
```
A URL foi corrigida (não dá mais 404), mas a API da Target Data exige whitelist de IP. Os Edge Functions do Lovable Cloud usam IPs dinâmicos — **isso precisa ser resolvido no painel da Target Data**.

**Opções:**
- Liberar o range de IPs do Supabase Edge Functions na Target Data
- Ou desabilitar a restrição de IP na Target Data para a sua API key

Isso é uma configuração externa, não do código.

### 2. Edge Function `targetdata-webhook` — JWT bloqueando webhook externo
O `config.toml` não tem `verify_jwt = false` para o webhook. O Supabase bloqueia a requisição antes do código rodar, retornando 401 mesmo com o `x-webhook-secret` correto.

**Correção:** Adicionar no `config.toml`:
```toml
[functions.targetdata-webhook]
verify_jwt = false
```

### 3. Webhook não parseia o schema real da Target Data
O código do webhook (`targetdata-webhook`) ainda usa o parsing antigo (campos planos como `telefones`, `celular`, `email`). Precisa ser atualizado para o schema aninhado `contato.telefone[]` / `contato.email[]` / `contato.endereco[]`, igual ao que já foi feito no `targetdata-enrich`.

## Alterações necessárias

| Arquivo | Alteração |
|---------|-----------|
| `supabase/config.toml` | Adicionar `[functions.targetdata-webhook] verify_jwt = false` |
| `supabase/functions/targetdata-webhook/index.ts` | Atualizar parsing para schema aninhado da Target Data + salvar em `client_phones` |

## Ação manual do usuário (não é código)
Liberar o IP dos Edge Functions na Target Data. Sem isso, a `targetdata-enrich` continuará recebendo "IP não autorizado".

