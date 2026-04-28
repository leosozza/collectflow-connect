# Correção: erro PGRST203 na Carteira + análise dos filtros

## 1. Causa do erro `PGRST203` (Carteira não carrega)

A migração anterior criou a nova versão de `get_carteira_grouped` com **22 parâmetros** (incluindo `_primeira_parcela_de` e `_primeira_parcela_ate`), mas a versão antiga de **20 parâmetros** continuou existindo no banco. Como os 20 primeiros parâmetros são idênticos, o PostgREST não consegue decidir qual chamar e retorna:

```
Could not choose the best candidate function between:
public.get_carteira_grouped(... 20 args)
public.get_carteira_grouped(... 22 args)
```

Isso bloqueia toda a Carteira (qualquer filtro retorna erro). É por isso que apareceu **"Nenhum cliente encontrado"** mesmo com Score = "Bom" selecionado.

## 2. Correção (migração)

```sql
DROP FUNCTION IF EXISTS public.get_carteira_grouped(
  uuid, integer, integer, text, text, date, date,
  uuid[], uuid[], uuid[], integer, integer, text[],
  text, text, uuid, boolean, date, date, boolean
);
```

Mantém apenas a versão nova (22 args). Não há outros consumidores chamando a versão antiga — todos os caminhos do frontend já usam a nova assinatura.

## 3. Análise do filtro de Score

Verifiquei diretamente no banco:

| Faixa | Parcelas |
|---|---|
| Bom (≥75) | **49** |
| Médio (50–74) | 96 |
| Ruim (<50) | 12.771 |
| Sem score (NULL) | 421.582 |
| **Total** | 434.498 |

- A lógica em `clientService.ts` (linhas 502–511) está **correta** para "Bom" sozinho: `min=75, max=100`.
- A RPC aplica `COALESCE(propensity_score, 0) BETWEEN 75 AND 100`, ou seja, clientes sem score (NULL → 0) ficam de fora — comportamento esperado.
- Como existem apenas 49 parcelas com score "Bom" no banco inteiro (e elas podem estar agrupadas em poucos CPFs/credores ou pertencerem a outro tenant), é **plausível** que o seu tenant de fato não tenha nenhum cliente na faixa "Bom". Vou confirmar isso após a correção do erro PGRST203 — sem a função ambígua, o filtro pode até estar funcionando e retornando 0 legitimamente.
- Se realmente quiser ver os "Bom" do seu tenant: rodar **"Calcular Scores"** (botão no topo da Carteira) primeiro para popular `propensity_score` nos 421k registros sem score.

## 4. Demais filtros — análise por leitura de código

Todos repassam os parâmetros corretamente para a RPC e a RPC trata cada um:

| Filtro | Status |
|---|---|
| Buscar (nome/CPF/telefone/email) | OK — busca tokenizada accent-insensitive |
| Status de Carteira | OK — array UUID |
| Credor | OK |
| Perfil do Devedor | OK — array text |
| Tipo de Dívida | OK — array UUID |
| Faixa de Score | OK (ver item 3) |
| Vencimento De/Até | OK — em qualquer parcela |
| Cadastro De/Até | OK — `created_at::date` |
| Primeira Parcela De/Até (novo) | OK — `HAVING MIN(data_vencimento)` |
| Valor Aberto De/Até | **Não enviado à RPC** (filtrado no client) — é o comportamento atual, não foi alterado |
| Nunca formalizou acordo | OK |
| Sem disparo de WhatsApp | OK |
| Higienizados / Sem contato / Em dia / Quitados | Filtros UI que afetam apenas exibição local — não foram alterados |

## 5. Próximos passos após aprovação

1. Aplicar a migração `DROP FUNCTION` acima.
2. Recarregar a Carteira — o erro PGRST203 deve sumir.
3. Validar Score "Bom": se ainda voltar 0, recomendo rodar "Calcular Scores".
4. Validar visualmente o novo filtro "Primeira Parcela De/Até".

## Arquivos afetados

- Nova migração SQL (1 statement DROP).
- Nenhuma alteração de código frontend.
