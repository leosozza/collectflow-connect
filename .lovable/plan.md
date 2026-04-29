# Aplicar migração das 16 RPCs de BI + validação

## O que será feito (sem alterar nada existente)

1. **Aplicar migração** com as 16 novas funções `get_bi_*` (já preparadas em `/tmp/bi_rpcs.sql`), todas:
   - `SECURITY DEFINER`, `STABLE`, `search_path = public`
   - Filtro obrigatório `tenant_id = _tenant_id`
   - Receita usando **apenas `manual_payments`** (status `confirmed`/`approved`) como SSoT
   - `get_bi_score_vs_result` reescrita com `EXISTS` (sem `MIN(uuid)`)
   - `get_bi_response_time_by_channel` usando `LEAD()` (sem subquery correlacionada)
   - `GRANT EXECUTE` para `authenticated`

2. **Validação automática pós-migração** (somente leitura, via `supabase--read_query`):
   - Listar via `pg_proc` as 16 funções criadas com seus parâmetros
   - Resolver `tenant_id` do YBRASIL
   - Executar amostras (últimos 7 dias, todos credores) em:
     - **Receita (3)**: `get_bi_revenue_summary`, `get_bi_revenue_by_period`, `get_bi_revenue_by_credor`
     - **Funil (2)**: `get_bi_collection_funnel`, `get_bi_funnel_dropoff`
     - **Qualidade (2)**: `get_bi_breakage_analysis`, `get_bi_recurrence_analysis`
   - Medir tempo via `EXPLAIN ANALYZE` em 2 funções suspeitas de peso (`response_time_by_channel`, `collection_funnel`)

3. **Relatório final**:
   - Lista completa (nome + parâmetros + descrição) das 16 funções
   - Retornos das 7 amostras (receita/funil/qualidade)
   - Diagnóstico por função: dados coerentes? nulos indevidos? duplicidade? risco de double-count? tempo perceptível?
   - Possíveis melhorias futuras (índices sugeridos, sem aplicar)

## Garantias

- Nenhuma função existente alterada
- Nenhum dado modificado (apenas SELECT/EXPLAIN nos testes)
- Nenhuma tela / query frontend tocada
- Apenas `CREATE OR REPLACE FUNCTION` em nomes novos com prefixo `get_bi_`

## Próximo passo após aprovação

Disparar `supabase--migration` com o conteúdo de `/tmp/bi_rpcs.sql` e em seguida rodar a bateria de validação read-only.
