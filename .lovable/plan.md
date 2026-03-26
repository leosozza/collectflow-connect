

# Plano: Alinhar payload ao teste Postman que funcionou

## O que o teste Postman provou

O boleto foi gerado com sucesso com este payload exato:

```text
POSTMAN (SUCESSO)                      NOSSO CÓDIGO (FALHA)
─────────────────                      ────────────────────
cliente.bairro: "Centro" ✓            delete bairro ← REMOVEMOS!
cliente.numero: "3000"                 numero: "" ou "SN" ← VAZIO!
cliente.telefones: ["11999991111"]     telefones: ["11945542245"] ✓
id_geral: "RIVO-TESTE-1001"           "53591244" ✓ (string ok)
parcelas[0].id_parcela: "1001"         sem id_parcela ou "2" ← CONFLITO
```

## Problemas encontrados (3 bugs)

1. **`bairro` deletado** (proxy linha 179): `delete clienteObj.bairro` remove o campo, mas o Postman provou que a API ACEITA `bairro`. Sem ele, a validação de endereço pode falhar.

2. **`numero` vazio**: O service envia `""` ou `"SN"` quando não extrai do endereço. O Postman usou `"3000"`. Número vazio pode causar rejeição.

3. **Payload flat no proxy**: Os logs mais recentes mostram que o proxy recebeu dados FLAT (sem `cliente` wrapper) e repassou assim para a API. Isso acontece quando `cobrancaData.cliente` e `cobrancaData.devedor` são ambos undefined -- o bloco `if (clienteObj)` não executa e os dados vão flat para `/cobranca/nova`.

## Correções

### `supabase/functions/negociarie-proxy/index.ts`
1. **Remover `delete clienteObj.bairro`** -- bairro é aceito pela API
2. **Adicionar fallback para payload flat**: se não existir `cliente` nem `devedor` mas existir `documento`/`nome` na raiz, montar automaticamente o objeto `cliente` + `parcelas` a partir dos campos flat
3. Manter `numero` default como `"SN"` (melhor que vazio)

### `src/services/negociarieService.ts`
1. **Incluir `bairro`** no objeto `cliente` do `buildBoletoPayload` (busca do DB já traz `bairro`)
2. **`id_parcela`**: usar timestamp-based unique ID quando `installment.number === 0` em vez de string vazia (evitar omissão e conflito)

### `src/components/integracao/CobrancaForm.tsx`
1. Já envia payload estruturado correto -- só precisa incluir `bairro` no objeto `cliente` (linha 142 está sem bairro)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/negociarie-proxy/index.ts` | Manter `bairro`; fallback flat→estruturado |
| `src/services/negociarieService.ts` | Incluir `bairro`; `id_parcela` nunca vazio |
| `src/components/integracao/CobrancaForm.tsx` | Incluir `bairro` no `cliente` |

