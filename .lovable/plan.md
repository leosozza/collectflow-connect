

## Plano: Remover campo "Cor Primária" da Central da Empresa

O campo de cor primária já existe no cadastro de cada Credor (aba Portal), onde faz mais sentido pois permite personalização por credor. Vamos removê-lo da Central da Empresa.

### Alteração em `src/pages/TenantSettingsPage.tsx`

1. Remover o estado `primaryColor` (linha 67)
2. Remover `primary_color: primaryColor` do `handleSave` (linha 84)
3. Remover o bloco de UI "Cor primária" (linhas 178-189)

O save continuará funcionando normalmente apenas com o campo `name`.

### Arquivo alterado
- `src/pages/TenantSettingsPage.tsx`

