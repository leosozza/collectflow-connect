## Plano de correção segura do Report Center

### Diagnóstico confirmado
- O seletor mostra **“Nenhum credor cadastrado”** porque o frontend consulta `credores.nome`, mas a tabela real usa `razao_social` e `nome_fantasia`. A requisição está retornando erro 400: `column credores.nome does not exist`.
- A **Análise da Carteira** está errada porque a função atual considera inadimplente apenas `clients.status = 'pendente'` e ainda soma parcelas de acordos da Rivo.
- Pela regra correta informada: **inadimplência = títulos originais em `clients` com `data_vencimento < hoje`, saldo aberto > 0 e não quitados/pagos**.
- O **aging** deve sair exclusivamente dos títulos originais (`clients.data_vencimento`), não de `agreement_installments` nem de acordos firmados na Rivo.

### Ajustes planejados
1. **Corrigir o filtro de credor**
   - Trocar a query de credores para buscar `razao_social` e `nome_fantasia`.
   - Exibir o nome amigável, mas usar o valor compatível com `clients.credor` no filtro.
   - Adicionar fallback a partir de `clients.credor` quando existir carteira importada sem cadastro correspondente na tabela `credores`.

2. **Substituir a lógica da RPC `get_carteira_overview`**
   - Manter o mesmo nome da função para não quebrar a tela.
   - Calcular tudo a partir da tabela `clients`:
     - `total_cpfs_base`: CPFs distintos na carteira.
     - `cpfs_inadimplentes`: CPFs distintos com ao menos um título original vencido e aberto.
     - `parcelas_inadimplentes`: quantidade de títulos originais vencidos e abertos.
     - `saldo_total`: soma do saldo aberto dos títulos originais vencidos.
     - `ticket_medio`: `saldo_total / cpfs_inadimplentes`.
     - aging por faixas usando `CURRENT_DATE - clients.data_vencimento`.
   - Remover da composição da inadimplência real os acordos e parcelas da Rivo.

3. **Ajustar textos e KPIs na tela**
   - Alterar hints para deixar claro que o saldo e aging são dos **títulos originais vencidos em aberto**.
   - Trocar qualquer menção de “quebras de acordo” no aging da carteira para não misturar com carteira original.
   - Manter o funil como “Base Operada no Período”, pois ele é operacional e depende de ações/logs no período.

4. **Prestação de Contas**
   - Corrigir o seletor de credor também nesta tela.
   - Usar a mesma origem corrigida para “Valor Pendente”, respeitando a visão por credor.

5. **Validação antes de concluir**
   - Conferir a RPC com a base Y.BRASIL após a migração.
   - Validar que o seletor de credor carrega ao menos o credor da carteira (`TESS MODELS PRODUTOS FOTOGRAFICOS LTDA`) e/ou o cadastro formal (`Maxfama`) conforme dados disponíveis.
   - Conferir que os números sobem para a ordem esperada: dezenas de milhares de CPFs inadimplentes e dezenas de milhões em saldo aberto, em vez de 58 CPFs e R$ 259 mil.