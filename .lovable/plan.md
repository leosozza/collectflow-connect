

# Corrigir teste de conexão Target Data

## Problemas encontrados

1. **Auth check usa `getClaims()` que não existe** no Supabase JS client. A função crasha com erro e retorna 401, o teste nunca chega à API Target Data.
2. **CPF de teste `00000000000` é inválido** — a documentação fornece CPFs de sandbox: `460.209.678-67` e `750.320.300-58`.
3. **Tratamento de erro da API** — a resposta de erro pós-autenticação vem em `header.code_error`, não em `code_error` na raiz (conforme docs).

## Alterações

### `supabase/functions/targetdata-enrich/index.ts`
- Trocar `getClaims()` por `getUser()` para validar autenticação
- Usar CPF de sandbox `46020967867` no test mode
- Verificar `code_error` tanto na raiz quanto em `header.code_error` (formatos pré e pós autenticação)

### `src/components/admin/integrations/TargetDataTab.tsx`
- Sem alterações necessárias — já envia `test_mode: true` e trata os erros corretamente

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/targetdata-enrich/index.ts` | Fix auth (`getUser`), sandbox CPF, melhor detecção de erro |

