

# Corrigir erros de build que impedem o preview

## Problema
Dois erros de build estão impedindo a aplicação de carregar:

1. **WhatsAppIntegrationTab.tsx** — `);` duplicado na linha 212 (erro de sintaxe)
2. **process-email-queue/index.ts** — tipos TypeScript rejeitando `as any` nos métodos `.insert()` e `.rpc()`

## Correções

### 1. `src/components/integracao/WhatsAppIntegrationTab.tsx` — linha 212
Remover o `);` extra na linha 212. O return já fecha corretamente na linha 211.

### 2. `supabase/functions/process-email-queue/index.ts` — linhas 63 e 70
Adicionar cast explícito nos valores para contornar a tipagem estrita:
- Linha 63: `await (supabase.from('email_send_log') as any).insert({...})`
- Linha 70: `await (supabase as any).rpc('move_to_dlq', {...})`

Isso move o `as any` para englobar o objeto retornado, evitando o erro de tipo `never`.

