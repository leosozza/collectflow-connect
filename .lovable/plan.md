

# Fix: Remover código duplicado no MaxListPage.tsx

## Problema
O arquivo `MaxListPage.tsx` tem código duplicado/órfão das linhas 1187-1357. O componente termina corretamente na linha 1186 (`export default MaxListPage;`), mas depois há JSX solto que causa erro de sintaxe e impede a página de abrir.

## Correção
Deletar as linhas 1187-1357 do arquivo. Essas linhas são uma cópia parcial do final do componente que foi acidentalmente deixada durante a edição anterior (batching).

