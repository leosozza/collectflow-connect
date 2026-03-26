

# Plano: Resolver erro 500 na geração de boleto Negociarie

## Diagnóstico

O payload enviado está estruturalmente correto (`{ cliente, id_geral, parcelas }`), mas a API Negociarie retorna 500 (erro interno do servidor, não validação). Isso sugere que o servidor tenta acessar campos que não existem no payload e crasha.

Comparando o payload enviado com a documentação:

```text
ENVIADO:                          DOCS ESPERAM:
─────────                         ──────────────
documento ✓                       documento ✓
nome ✓                            nome ✓
cep ✓                             cep ✓
endereco ✓                        endereco ✓
cidade ✓                          cidade ✓
uf ✓                              uf ✓
telefones ✓                       telefones ✓
email ✓                           email ✓
(ausente)                         numero ← falta!
(ausente)                         complemento ← falta!
valor: 10 (inteiro)               valor: 10.00 (decimal?)
```

## Problemas prováveis

1. **`numero` ausente**: Removido na última correção (omitir vazios). A API pode exigir a chave mesmo vazia — sem ela, o servidor pode crashar ao tentar ler o campo
2. **`complemento` ausente**: Mesmo caso
3. **`valor` como inteiro**: `10` em vez de `10.00` — algumas APIs rejeitam inteiros quando esperam float

## Correções

### `src/services/negociarieService.ts`
- Sempre incluir `numero` e `complemento` no objeto `cliente` (string vazia se não houver valor)
- Garantir que `valor` nas parcelas seja sempre float com `parseFloat(value.toFixed(2))`

### `supabase/functions/negociarie-proxy/index.ts`
- Garantir que `numero` e `complemento` existam no `clienteObj` antes de enviar (default para `""`)
- Converter `valor` de cada parcela para float explícito

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Incluir `numero` e `complemento` sempre; forçar `valor` como float |
| `supabase/functions/negociarie-proxy/index.ts` | Default `numero`/`complemento` para `""`; converter `valor` para float |

