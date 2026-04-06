

# Plano: Permissão para Disparo WhatsApp na Carteira

## Situação Atual

O botão de disparo WhatsApp na Carteira (`CarteiraPage.tsx`, linha 544) aparece para qualquer usuário que selecione clientes. Não há verificação de permissão.

O módulo `campanhas_whatsapp` já existe no sistema de permissões com a ação `create` — que só está liberada para `admin` e `super_admin` por padrão. Operadores têm apenas `view_own`.

## Solução

Reutilizar a permissão `canCreateCampanhas` (que verifica `campanhas_whatsapp.create`) para controlar a visibilidade do botão de disparo.

## Alteração

**Arquivo**: `src/pages/CarteiraPage.tsx`

1. Importar `usePermissions` (se ainda não estiver importado)
2. Extrair `canCreateCampanhas` do hook
3. Condicionar o botão WhatsApp: só renderizar se `canCreateCampanhas === true`

Isso significa que o admin pode ir em **Permissões** e adicionar a ação `create` no módulo `Campanhas WhatsApp` para qualquer operador ou perfil que desejar liberar.

## Nenhuma alteração em

- `usePermissions.ts` (a permissão já existe)
- Perfis de permissão (admin configura pela interface)
- Campanhas, automação, webhook, Contact Center

