

## Plano: Simplificar página de Perfil

### Alterações

**1. `src/pages/PerfilPage.tsx`**
- Remover Tabs — exibir Dados Pessoais e Segurança juntos na mesma página (sem abas)
- Remover `ProfileStatsCards` (acordos, valor negociado, taxa, conquistas, rivocoins)
- Renderizar `PersonalDataTab` seguido de `SecurityTab` em sequência vertical

**2. `src/components/perfil/SecurityTab.tsx`**
- Remover o card "Alterar Senha" (campos nova senha / confirmar senha)
- Manter apenas:
  - Email de login (somente leitura)
  - 2FA (ativar/desativar)
  - Redefinir senha por email (botão que envia link)

**3. `src/components/perfil/ProfileStatsCards.tsx`**
- Pode ser mantido no projeto mas não será mais importado na PerfilPage

### Arquivos alterados
- `src/pages/PerfilPage.tsx`
- `src/components/perfil/SecurityTab.tsx`

