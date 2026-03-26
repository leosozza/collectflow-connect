

# Plano: Corrigir campo `nome` no payload da Negociarie

## Problema raiz

A API Negociarie retorna 400: `"Preencha os dados corretamente [documento, nome, cep, endereco, cidade, uf]"`. 

O campo esperado é **`nome`**, mas estamos enviando **`razao_social`** e deletando `nome` (linha 175 do proxy).

## Comparação lado a lado

```text
ENVIADO HOJE:                         API ESPERA:
──────────────                        ──────────────
devedor.razao_social ← ERRADO         devedor.nome ← CERTO
devedor.documento ✓                   devedor.documento ✓
devedor.cep ✓                         devedor.cep ✓
devedor.endereco ✓                    devedor.endereco ✓
devedor.cidade ✓                      devedor.cidade ✓
devedor.uf ✓                          devedor.uf ✓
devedor.celular ✓                     devedor.celular ✓
devedor.email ✓                       devedor.email ✓
```

## Correção

### `src/services/negociarieService.ts`
- Trocar `razao_social` por `nome` no objeto `devedor`

### `supabase/functions/negociarie-proxy/index.ts`
- Remover a lógica que converte `nome` → `razao_social` (linhas 146-151)
- Remover o `delete devedorObj.nome` (linha 175)
- Garantir que o campo `nome` existe e está trimado

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | `razao_social` → `nome` |
| `supabase/functions/negociarie-proxy/index.ts` | Remover conversão `nome→razao_social`; manter `nome` |

