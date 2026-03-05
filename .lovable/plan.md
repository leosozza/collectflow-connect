

## Plano: Selecionar e importar todos os registros em lotes de 1000

### Problema
Atualmente o MaxList limita a exibição e seleção a 1000 registros (`data.slice(0, 1000)`). O "selecionar todos" só marca os primeiros 1000, e registros além disso são ignorados na importação.

### Alterações em `src/pages/MaxListPage.tsx`

1. **Remover o limite de 1000 na visualização da tabela**: trocar `data.slice(0, 1000)` por exibir todos os registros (a tabela já usa ScrollArea, suporta scroll)

2. **Ajustar `toggleAll`**: ao clicar "selecionar todos", selecionar TODOS os índices de `data` (não apenas os primeiros 1000)

3. **Importação em lotes automáticos**: o `handleMappingConfirmed` já processa em lotes de `BATCH_SIZE = 200`. Nenhuma alteração necessária na lógica de envio — ela já itera sobre todos os `records` selecionados. O gargalo era apenas a seleção, não o envio.

4. **Indicador visual**: mostrar no badge de contagem quantos estão selecionados vs total (ex: "5.432 selecionados de 5.432")

### Resumo
A única mudança real é remover o `slice(0, 1000)` e ajustar o `toggleAll` para selecionar todos os índices de `data`. A importação já funciona em lotes de 200, então todos serão enviados corretamente.

