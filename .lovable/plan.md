## Causa do erro

Ao salvar a aba **Bancário** do credor, o frontend manda o campo `cobrança_direta_ativa` (toggle "Cobrança Direta") para a tabela `credores`. Essa coluna **não existe** no schema atual — por isso o PostgREST retorna:

> Could not find the 'cobrança_direta_ativa' column of 'credores' in the schema cache

Confirmações:
- Lista atual de colunas em `public.credores` — não tem `cobrança_direta_ativa` (nem variante sem cedilha).
- `src/components/cadastros/CredorForm.tsx` (linhas 533-563) faz `set("cobrança_direta_ativa", v)` e o `saveMutation` envia o `form` inteiro no upsert.
- `src/components/admin/integrations/NegociarieTab.tsx` (linha 26) também filtra `eq("cobrança_direta_ativa", true)` para listar credores com recebimento direto.

Ou seja, o nome da coluna sempre foi previsto **com cedilha**, mas a migration nunca foi criada.

## O que vou fazer

1. Criar migration adicionando a coluna na tabela `credores`:
   - Nome: `"cobrança_direta_ativa"` (com cedilha, mantendo identifier quoted, igual ao código).
   - Tipo: `boolean`, `NOT NULL`, `DEFAULT false`.
   - Index parcial em `(tenant_id) WHERE "cobrança_direta_ativa" = true` para acelerar o lookup do painel Negociarie.
2. Não vou tocar em RLS (a tabela já tem políticas e a coluna apenas se acopla a elas).
3. Após a migration, o tipo `Database` do Supabase é regenerado automaticamente — o código existente passa a compilar/funcionar sem mudanças adicionais.

## Verificação pós-migration

- Salvar novamente a aba Bancário com toggle ligado → deve persistir sem erro.
- Abrir o painel **Configurações → Integrações → Negociarie** (admin) → o card "Contas de Credores Conectadas" deve listar credores com a flag.
- Conferir que o credor `143cc8af…` (TESS MODELS) reflete o estado correto do switch.

## Observação

O nome da coluna usa caractere acentuado (`ç`). Funciona em Postgres porque o identifier vai quoted, mas é incomum. Se quiser, posso renomear para `cobranca_direta_ativa` (sem cedilha) e ajustar as 2 referências no frontend — diga se prefere essa variante mais limpa, senão sigo com o nome atual que o código já espera.