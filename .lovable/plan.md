## Contexto

Você sincronizou o GitHub e o código frontend já está alinhado:

- `ManualPaymentDialog.tsx` já tem inputs de Juros, Multa, Honorários e Descontos.
- `manualPaymentService.ts` já expõe esses campos em `CreateManualPaymentData`.
- `BaixasRealizadasPage.tsx` já usa `operator_id` e mantém o fallback visual "Sistema/Importação".
- A migration `supabase/migrations/20260425184800_final_fix_baixas_realizadas.sql` está presente no repositório.

O que **ainda não foi aplicado** é a função SQL no banco. Confirmei consultando `pg_proc`: a definição atual de `public.get_baixas_realizadas` no Supabase **não contém** `SELECT user_id FROM profiles WHERE id = mp.requested_by` — ou seja, está rodando uma versão anterior que devolve o `profile.id` em vez do `auth.user_id`. Por isso o operador continua aparecendo como "Sistema/Importação".

## Mudança

Aplicar a migration `20260425184800_final_fix_baixas_realizadas.sql` via ferramenta de migration do Supabase. Ela faz:

- `DROP FUNCTION IF EXISTS public.get_baixas_realizadas(date, date, text, text, text)`.
- `CREATE OR REPLACE FUNCTION public.get_baixas_realizadas(...)` mantendo a mesma assinatura de parâmetros e o mesmo `RETURNS TABLE` (incluindo `operator_id uuid`).
- Para a fonte **manual**: troca `mp.requested_by` direto por `COALESCE((SELECT user_id FROM profiles WHERE id = mp.requested_by LIMIT 1), a.created_by)`, resolvendo a divergência `profile.id` × `auth.user_id`.
- Para **portal** e **negociarie**: usa `a.created_by` como `operator_id` (fallback consistente com o que o frontend já espera).
- Mantém os filtros existentes (`_date_from`, `_date_to`, `_credor`, `_local`, `_payment_method`) aplicados sobre o `WITH unified` final.

Nenhuma alteração de schema de tabela, RLS, código frontend ou outras funções é necessária. A `SECURITY DEFINER` + `SET search_path = public` já estão presentes na migration.

## Resultado esperado

- Coluna **Operador** em `/financeiro/baixas` passa a exibir o nome real do usuário para baixas manuais (resolvido via `profiles.id → user_id → profiles.full_name` no frontend).
- Para baixas Portal/Negociarie, exibe o criador do acordo (`a.created_by`) ou o fallback "Sistema/Importação" quando não houver match.
- Encargos (juros/multa/honorários/desconto) cadastrados no novo `ManualPaymentDialog` aparecem corretamente, pois a RPC já lê `mp.interest_amount`, `mp.penalty_amount`, `mp.fees_amount`, `mp.discount_amount`.