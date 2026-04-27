## Simplificar tela "Editar Template" (Conquistas)

### Mudanças em `src/components/gamificacao/AchievementsManagementTab.tsx`

1. **Renomear "Valor do Critério" → "Meta"** com texto de ajuda dinâmico baseado no critério escolhido:
   - `agreements_count` → "Acordos formalizados necessários"
   - `payments_count` → "Pagamentos necessários"
   - `total_received` → "Valor recebido necessário (R$)"
   - `no_breaks` / `goal_reached` / `manual` → ocultar o campo (não usa valor)

2. **Remover o campo "Credor"** do diálogo de formulário (linhas 337–348). O salvamento continuará enviando `credor_id: null` (Global), mantendo compatibilidade com dados existentes.

3. **Remover a coluna "Credor"** da tabela de listagem (cabeçalho linha 194 e célula linha 209).

### Resultado esperado
Tela enxuta: Título, Descrição, Ícone, Critério, Meta, Pontos. Para "250 acordos formalizados = 250 pontos", basta selecionar critério "Qtd. de acordos formalizados", Meta = 250, Pontos = 250.
