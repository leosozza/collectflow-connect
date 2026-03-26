

# Plano: Adicionar campo `numero` ao payload Negociarie

## Diagnóstico

O payload enviado contém todos os campos listados no erro (`documento, nome, cep, endereco, cidade, uf`), mas a API retorna 400. A causa provável é que o campo **`numero`** (número do endereço) é obrigatório na API mas não está sendo enviado. Sem ele, a validação do endereço falha.

O campo `numero` não existe na tabela `clients` — o import concatena tudo em `endereco`. Precisamos enviá-lo como string vazia `""` quando não disponível.

## Payload atual vs esperado

```text
ENVIADO:                              API ESPERA:
──────────────                        ──────────────
devedor.documento ✓                   devedor.documento ✓
devedor.nome ✓                        devedor.nome ✓
devedor.cep ✓                         devedor.cep ✓
devedor.endereco ✓                    devedor.endereco ✓
(ausente)                             devedor.numero ← FALTA
(ausente)                             devedor.complemento ← FALTA
devedor.bairro ✓                      devedor.bairro ✓
devedor.cidade ✓                      devedor.cidade ✓
devedor.uf ✓                          devedor.uf ✓
devedor.email ✓                       devedor.email ✓
devedor.celular ✓                     devedor.celular ✓
```

## Correções

### `src/services/negociarieService.ts`
- Adicionar `numero: ""` e `complemento: ""` no objeto `devedor` em `buildNegociariePayload` (linhas ~119-120)
- Esses campos não existem na tabela `clients`, então sempre serão string vazia

### `supabase/functions/negociarie-proxy/index.ts`
- Garantir que `numero` e `complemento` existam no `devedorObj` com default `""` caso ausentes (após linha 165, antes de enviar)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Adicionar `numero: ""` e `complemento: ""` ao devedor |
| `supabase/functions/negociarie-proxy/index.ts` | Default `numero`/`complemento` para `""` se ausentes |

