

# Plano: Corrigir 500 na geração de boleto — `id_geral` duplicado

## Diagnóstico

Comparei o payload final do proxy (logs) com o Postman lado a lado:

```text
LOVABLE (500)                              POSTMAN (200)
─────────                                  ──────────
id_geral: "53591244"                       id_geral: "RIVO-TESTE-1001"
valor: 11                                  valor: 10.0
bairro: "Quitaúna" (acento)               bairro: "Centro"
parcelas sem valor_mora_dia/multa          parcelas COM valor_mora_dia/multa
```

A estrutura é **idêntica**. O problema não é o formato do payload — é o **dado**.

O `id_geral: "53591244"` foi enviado em **múltiplas tentativas** anteriores. Em tentativas passadas, a API retornou `400: "Já existe boleto gerado com o código 2"`. Agora com um `id_parcela` diferente (`"54231285"`), o servidor da Negociarie **crashou** (500) ao tentar adicionar uma parcela nova a um `id_geral` que já tem parcelas registradas com status conflitante.

O `id_geral` atual é gerado como hash numérico fixo a partir do `agreement_id` — ou seja, é **sempre o mesmo** para o mesmo acordo. Cada tentativa de gerar boleto reenvia o mesmo `id_geral`, causando conflito.

## Correção

### `src/services/negociarieService.ts`
1. Tornar `id_geral` único por tentativa: incluir timestamp ou contador para evitar colisão. Formato: `"RIVO-{agreementIdShort}-{timestamp}"` (ex: `"RIVO-535d-1774553000"`)
2. Adicionar `valor_mora_dia: 0` e `valor_multa: 0` nas parcelas (campos presentes no Postman que funcionou)

### `supabase/functions/negociarie-proxy/index.ts`
1. Garantir que `valor` seja enviado como float com 2 casas decimais na serialização (usar `parseFloat(valor.toFixed(2))`)
2. Log adicional: logar o `id_geral` sendo enviado para facilitar debug de duplicidade

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | `id_geral` único por tentativa; adicionar `valor_mora_dia`/`valor_multa` |
| `supabase/functions/negociarie-proxy/index.ts` | Forçar float em `valor`; log do `id_geral` |

