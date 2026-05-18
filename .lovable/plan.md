## Diagnóstico

O erro **"Edge Function returned a non-2xx status code"** é a mensagem genérica que o `supabase.functions.invoke` retorna sempre que a edge function devolve qualquer status diferente de 2xx. O problema **não é** no backend — a edge function `generate-agreement-boletos` está retornando o motivo real corretamente:

Confirmado nos logs (function_edge_logs): todas as últimas chamadas devolveram **HTTP 400** com um JSON `{ "error": "<mensagem real>" }` no body. Os 400 com 555-620 ms duram tempo demais para serem validação de entrada — são erros vindos dos guards do meio do fluxo (parcela já paga, método ≠ BOLETO, parcela inexistente, ou repasse de erro da Negociarie).

### Por que o operador vê só o texto genérico

No `AgreementInstallments.tsx` o handler faz:

```ts
const { data, error } = await supabase.functions.invoke("generate-agreement-boletos", {...});
if (error) throw new Error(error.message || "...");   // ❌ pega "non-2xx status code"
if (data?.error) throw new Error(data.error);          // ⚠️ não roda — data é null em 4xx/5xx
```

Quando a edge devolve **status 4xx/5xx**, o supabase-js cria um `FunctionsHttpError` cujo `.message` é sempre o texto genérico. O body real (`{ error: "Parcela já paga — não é possível reemitir boleto" }`) fica escondido dentro de `error.context` (o `Response` original) — e `data` vem `null`. Por isso o `data?.error` nunca é alcançado.

### Já tínhamos travado isso?

Sim, mas só no canal de conversation: `src/services/conversationService.ts` (linhas 370–425) já tem uma função `extractFunctionError` que lê `error.context.json()` / `.text()` e devolve a mensagem real. Essa correção **não foi propagada** para os fluxos de boleto.

## Plano de correção (somente frontend)

### 1. Extrair `extractFunctionError` para util compartilhado

Criar `src/lib/extractFunctionError.ts` contendo a função pública (cópia do helper que está em `conversationService.ts`, sem mudanças de comportamento). Refatorar `conversationService.ts` para importar dele em vez de manter cópia local.

### 2. Aplicar nos fluxos de boleto

Trocar o padrão atual nos 3 chamadores de `generate-agreement-boletos`:

| Arquivo | Linha | Função |
|---|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | 471 | Reemitir boleto único |
| `src/components/client-detail/AgreementInstallments.tsx` | 881 | Gerar todos os boletos pendentes |
| `src/components/client-detail/AgreementCalculator.tsx` | 696 | Gerar boletos ao aprovar acordo |

Padrão novo:

```ts
const { data, error } = await supabase.functions.invoke("generate-agreement-boletos", {...});
if (error || data?.error) {
  const real = await extractFunctionError(error, data, "Erro ao gerar boleto");
  throw new Error(real);
}
```

`humanizeErrorMessage` continua sendo aplicado no toast (já trata JSON aninhado da Negociarie).

### 3. Resultado para o operador

Ao invés de `"Edge Function returned a non-2xx status code"` o toast passará a mostrar mensagens como:

- "Parcela já paga — não é possível reemitir boleto"
- "Método da parcela é PIX — altere para BOLETO antes de reemitir"
- "Negociarie rejeitou o cadastro do cliente (verifique CEP, endereço, e-mail e telefone)"
- "Cobrança direta ativa para este credor mas credenciais Negociarie não cadastradas..."
- "Dados cadastrais incompletos (cep, bairro). Boletos poderão ser gerados manualmente após correção."

## O que NÃO muda

- Nenhuma mudança em edge function, schema, RLS, fluxo de geração, Negociarie, ou regras de negócio.
- Mantém `humanizeErrorMessage` (que desempacota JSON inline) — apenas garante que ele receba a mensagem real, não o texto genérico do SDK.
- Os outros 2 callers em `src/services/agreementService.ts` (linhas 444 e 1163) podem ser revisados depois — não afetam o toast do operador na tela atual.

## Observação operacional

Após o deploy, na próxima tentativa do operador da Y.brasil veremos a causa real do 400 (provavelmente "Parcela já paga" ou método de pagamento ≠ BOLETO). Isso vai destravar a operação imediatamente.
