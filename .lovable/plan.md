# Melhoria de relevância na busca da Carteira

## Problema
Ao buscar "Fernanda Pereira", o sistema retorna primeiro "Fernanda Helena dos Santos Pereira" antes de "Fernanda Pereira dos Santos", porque a RPC `get_carteira_grouped` usa `ILIKE ALL` com palavras desordenadas — sem priorizar correspondências em sequência.

## Solução
Migration SQL recriando `get_carteira_grouped` com **score de relevância** calculado por linha, agregado por grupo (CPF/Credor) e usado como critério primário do `ORDER BY` quando há `_search`.

### Score por linha (na CTE `filtered`)
- **4** — nome exatamente igual ao termo (unaccent + lower)
- **3** — nome começa com o termo (`ILIKE termo || '%'`)
- **2** — nome contém a frase contígua (`ILIKE '%' || termo || '%'`) ← resolve o caso "Fernanda Pereira"
- **1** — match por palavras desordenadas, CPF, telefone ou email (comportamento atual)
- **0** — sem busca

### Agregação no `grouped`
`MAX(match_score)` por grupo CPF/Credor — preserva o melhor match do grupo.

### Ordenação
Quando `_search` é informado, `match_score DESC` torna-se o critério **primário**, mantendo os critérios atuais (`_sort_field`/`_sort_dir`) como desempate.

## Arquivos
- **Migration SQL**: redefine `public.get_carteira_grouped` (mesma assinatura, mesmas colunas de retorno)
- Sem alterações em frontend (`clientService.ts`, `CarteiraPage.tsx`)

## Impacto
- Sem breaking changes (assinatura idêntica)
- Performance equivalente (apenas expressões CASE adicionais; sem novos JOINs)
- Comportamento sem busca preservado integralmente
