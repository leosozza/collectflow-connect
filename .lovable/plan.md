

# Plano: Remover qualificações nativas do mapeamento editável

## O que mudar

O usuário quer que o dropdown de mapeamento mostre **apenas** as qualificações criadas na 3CPlus (IDs positivos), sem as nativas do sistema (IDs -2 a -5). As nativas já estão documentadas no card informativo abaixo — não precisam aparecer como opção de mapeamento.

## Correções em `src/components/integracao/ThreeCPlusTab.tsx`

1. **Remover SYSTEM_QUALIFICATIONS do dropdown de mapeamento** — Apagar o bloco de linhas 574-580 que renderiza as qualificações do sistema no SelectContent
2. **Remover SYSTEM_QUALIFICATIONS do merge no `loadQualifications`** — Linha 359-362: parar de misturar IDs negativos no array `qualifications`. Manter apenas os itens vindos da API (IDs positivos)
3. **Manter o card informativo** — O card readonly das linhas 595-652 continua existindo como referência visual

| Arquivo | Mudança |
|---|---|
| `src/components/integracao/ThreeCPlusTab.tsx` | Remover system quals do dropdown e do merge de qualifications |

