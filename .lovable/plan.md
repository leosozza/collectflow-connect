## Problema

Em `/financeiro/baixas`, o filtro **Operador** atualmente é montado a partir das próprias linhas da tabela e inclui valores genéricos como `"Negociarie"` e `"Portal"` em vez de listar os usuários operadores do tenant (Gustavo, Vitor, etc.).

A coluna **Operador** na tabela também exibe "Negociarie" / "Portal" para baixas que não foram lançadas manualmente, o que polui o filtro.

## Solução

Alinhar a tela ao padrão já usado em `RelatoriosPage` (e em `AssignOperatorDialog`), carregando a lista de operadores diretamente da tabela `profiles` filtrada por `tenant_id`.

### Mudanças em `src/pages/financeiro/BaixasRealizadasPage.tsx`

1. **Nova query `tenant-operators`**: busca `profiles` (`user_id`, `full_name`) do tenant atual, ordenado por nome — mesma lógica de `RelatoriosPage` linhas 45-52.

2. **Filtro Operador (Select)**: as opções passam a vir dessa query (lista fixa de operadores do tenant), não mais derivadas das linhas. Remove "Negociarie" e "Portal" do dropdown.

3. **Resolver operador por linha**:
   - `manual` → buscar `requested_by` em `manual_payments` e mapear para `profiles.full_name` (já existe, é mantido).
   - `portal` / `negociarie` → exibir `"—"` na coluna Operador (não há operador humano envolvido).

4. **Lógica de filtragem**: ao selecionar um operador, filtra apenas as linhas cujo `requested_by` corresponde ao `user_id` selecionado. Se "Todos" estiver selecionado, mantém todas as linhas (incluindo portal/negociarie).

5. **Export Excel**: campo Operador segue a mesma regra (nome do operador para manuais, `—` para portal/negociarie).

### Resultado

- Dropdown "Operador" mostra apenas usuários reais do tenant (Gustavo, Vitor, …), em ordem alfabética.
- "Negociarie" e "Portal" desaparecem do filtro.
- Coluna Operador na tabela mostra o nome do usuário que lançou a baixa manual, ou `—` para baixas automáticas (portal/negociarie).