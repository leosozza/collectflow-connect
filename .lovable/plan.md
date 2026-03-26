

# Plano: Corrigir payload do boleto para match exato com documentação Negociarie

## Diagnóstico (baseado na documentação oficial do Postman)

Analisei a documentação oficial do endpoint `/cobranca/nova` (Adicionar cobrança). Comparando com o que estamos enviando:

```text
DOCUMENTAÇÃO ESPERA                    ESTAMOS ENVIANDO
──────────────────                     ──────────────────
cliente.documento ✓                    cliente.documento ✓
cliente.nome ✓                         cliente.nome ✓
cliente.razao_social ✓                 cliente.razao_social ✓
cliente.cep ✓                          cliente.cep ✓
cliente.endereco (só logradouro)       cliente.endereco "Rua ..., 123" ← inclui número!
cliente.numero "100"                   cliente.numero "" ← vazio!
cliente.complemento ✓                  cliente.complemento ✓
cliente.cidade ✓                       cliente.cidade ✓
cliente.uf ✓                           cliente.uf ✓
cliente.telefones[] ✓                  cliente.telefones[] ✓
cliente.email ✓                        cliente.email ✓
(não existe na doc)                    cliente.bairro ← CAMPO EXTRA!

id_geral: 54 (inteiro)                id_geral: "ACORDO-535df9af" ← string!
parcelas[].id_parcela: "8723" (str)   parcelas[].id_parcela: 0 ← inteiro zero!
parcelas[].valor: 100.00              parcelas[].valor: 10 ✓
parcelas[].data_vencimento ✓          parcelas[].data_vencimento ✓
```

## Problemas encontrados

1. **`id_parcela: 0`** causa erro 500 no servidor (crash). O doc usa string `"8723"`, não inteiro zero.
2. **`bairro`** é um campo extra que não existe na documentação — pode causar rejeição.
3. **`id_geral`** na doc é inteiro, não string. Enviar `"ACORDO-535df9af"` pode ser aceito ou não, mas é uma divergência.
4. **`endereco`** inclui o número concatenado (`"Rua Luiz Henrique de Oliveira, 123"`) enquanto `numero` está vazio — o campo `endereco` deveria conter apenas o logradouro.
5. **`id_parcela: 2`** retornou "Já existe boleto gerado com o código 2" — precisamos usar IDs únicos por cobrança.

## Correções

### `src/services/negociarieService.ts`
- Remover `bairro` do objeto `cliente` (não existe na documentação)
- Converter `id_parcela` para string (como na doc: `"8723"`)
- Nunca enviar `id_parcela: 0` — usar `"1"`, `"2"`, etc., ou omitir se não tiver ID real
- Tentar extrair número do endereço (separar por vírgula) para preencher `numero`
- Gerar `id_geral` como string alfanumérica curta (a doc aceita string também no campo, mas o exemplo mostra inteiro)

### `supabase/functions/negociarie-proxy/index.ts`
- Remover `bairro` do `clienteObj` antes de enviar
- Garantir que `id_parcela` nunca seja `0` — se for `0`, converter para `"1"` ou deletar
- Converter `id_parcela` para string

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Remover `bairro`; `id_parcela` como string não-zero; extrair `numero` do endereço |
| `supabase/functions/negociarie-proxy/index.ts` | Remover `bairro`; sanitizar `id_parcela` |

## Resultado esperado
- Payload alinhado 100% com a documentação oficial
- Sem campo extra (`bairro`) que pode causar rejeição
- Sem `id_parcela: 0` que causa crash (500) no servidor

