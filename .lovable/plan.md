# Fix urgente: Dashboard zerado

## Causa raiz
A migration anterior criou as RPCs novas com **assinatura diferente** (`_user_ids uuid[]` adicionado), e o `CREATE OR REPLACE` do PostgreSQL **não substitui** uma função quando a lista de parâmetros muda — ele **cria uma sobrecarga**. Resultado: agora existem **duas versões** de cada RPC:

```
get_dashboard_stats(uuid, integer, integer)              ← antiga
get_dashboard_stats(uuid, integer, integer, uuid[])      ← nova
get_dashboard_vencimentos(date, uuid)                    ← antiga
get_dashboard_vencimentos(date, uuid, uuid[])            ← nova
get_acionados_hoje(uuid, uuid)                           ← antiga
get_acionados_hoje(uuid, uuid, uuid[])                   ← nova
```

Quando o frontend chama via PostgREST passando só `_user_id` (ou nenhum parâmetro), o resolver não consegue decidir qual sobrecarga usar → erro `PGRST203` ("Could not choose the best candidate function") → query falha silenciosamente → todos os cards ficam **zerados**.

## Correção (1 migration mínima)

Dropar as 3 funções **antigas** (3 args). As novas (4 args, com `_user_ids` opcional `DEFAULT NULL`) cobrem 100% dos casos antigos — chamadas sem `_user_ids` continuam funcionando idênticas ao comportamento original.

```sql
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.get_dashboard_vencimentos(date, uuid);
DROP FUNCTION IF EXISTS public.get_acionados_hoje(uuid, uuid);
```

## Garantias
- Não apaga dados, não toca em tabelas, RLS ou permissões.
- Nenhuma mudança no frontend é necessária — `DashboardPage.tsx` já passa parâmetros nomeados, vai resolver direto para a versão nova.
- Visual e cards permanecem idênticos.
- Após o drop, dashboard volta a carregar com os valores corrigidos da migration anterior (Quebra incluindo manual, Recebido = manual+portal, Parcelas Programadas sem falso-paid).

## Validação pós-fix
1. `SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname IN (...)` → deve retornar 1 linha por nome.
2. Recarregar `/dashboard` → KPIs voltam a popular.
