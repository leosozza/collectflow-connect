

# Equalizar visualização do perfil para Admin

## Problema identificado

Analisando o código, encontrei estas diferenças que fazem um perfil mostrar mais que outro:

1. **`ProfileStatsCards`** — componente pronto (Acordos Fechados, Valor Negociado, Taxa de Conversão, Conquistas, RivoCoins) mas **nunca usado** na página de perfil. Se Raul tem uma versão onde isso aparece, Barbara não vê.

2. **`SecurityTab`** — só aparece quando `isOwnProfile` é true (linha 73 do `PerfilPage.tsx`). Admin vendo perfil de outro usuário não vê essa seção.

3. **Email** — só aparece se `isTenantAdmin` é true. Se Barbara não é reconhecida como admin no `tenant_users`, o email fica oculto.

4. **Bio e Aniversário** — só aparecem se o campo tem valor preenchido. Se Barbara não preencheu, a seção fica mais vazia visualmente.

## Solução

### 1. Adicionar `ProfileStatsCards` à página de perfil
Importar e renderizar o componente de estatísticas para todos os perfis (próprio ou de outro usuário).

### 2. Mostrar SecurityTab para admin vendo outros perfis
Mudar a condição de `isOwnProfile` para `isOwnProfile || isTenantAdmin`. O SecurityTab já opera sobre o usuário logado (MFA, reset de senha), então quando admin visualiza perfil de outro, mostrar em modo somente leitura ou ocultar ações que só fazem sentido para o próprio usuário.

### 3. Garantir que campos vazios ainda mostrem placeholder
Em vez de esconder bio/aniversário quando vazios, mostrar "Não informado" para que a estrutura visual seja sempre a mesma.

### Arquivos
- `src/pages/PerfilPage.tsx` — adicionar `ProfileStatsCards` e ajustar condição do `SecurityTab`
- `src/components/perfil/PersonalDataTab.tsx` — mostrar placeholders para campos vazios

