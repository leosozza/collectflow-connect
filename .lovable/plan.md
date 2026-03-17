

# Remover "Campos Personalizados" da página Cadastros

Mudança simples em `src/pages/CadastrosPage.tsx`:

1. **Remover do menu lateral**: Tirar `{ key: "campos_personalizados", ... }` do grupo "Acesso" (linha 91)
2. **Remover a renderização**: Tirar `{active === "campos_personalizados" && <CustomFieldsConfig />}` (linha 189)
3. **Limpar imports não utilizados**: Remover import de `CustomFieldsConfig` e o ícone `Puzzle` se não usado em outro lugar

O componente já está disponível dentro da aba **Personalização** do perfil do credor, então basta remover a duplicação.

