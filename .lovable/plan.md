

## Plano: Remover "Mapeamento de Campos" da página Cadastros

A aba "Mapeamento de Campos" será removida da página `/cadastros`, mantendo apenas "Campos Personalizados". O mapeamento continuará disponível nos fluxos de importação (MaxList, Planilha, API) onde já está integrado.

### Alterações em `src/pages/CadastrosPage.tsx`

1. Remover a entrada `{ key: "mapeamento_campos", label: "Mapeamento de Campos", icon: Columns }` do array de tabs
2. Remover o render condicional `{active === "mapeamento_campos" && <FieldMappingConfig />}`
3. Remover o import de `FieldMappingConfig` e o ícone `Columns` (se não usado em outro lugar)

Nenhum outro arquivo precisa ser alterado — o componente `FieldMappingConfig.tsx` permanece no projeto pois pode ser reutilizado futuramente.

