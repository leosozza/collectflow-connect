
Objetivo: corrigir a ausência do “Contact Center” no sidebar em produção, sem mexer primeiro nas permissões erradas, porque a revisão indica que o problema principal não é RBAC.

O que encontrei
1. O sidebar não mostra “Contact Center” por causa do slug `contact_center` sozinho. Em `src/components/AppLayout.tsx`, o grupo só aparece se houver pelo menos 1 item filho visível:
   - “Telefonia” exige `permissions.canViewTelefonia` + `isModuleEnabled("telefonia")`
   - “WhatsApp” exige `permissions.canViewContactCenter` + `isModuleEnabled("whatsapp")`
2. Ou seja: hoje o módulo `contact_center` não controla diretamente a visibilidade do grupo. O sidebar depende de `telefonia` e/ou `whatsapp`.
3. As permissões do tenant Y.BRASIL estão corretas:
   - perfil `Operador Padrão`: `contact_center = [view]` e `telefonia = [view]`
   - perfil `Admin Padrão`: `contact_center = [view, manage_admin]` e `telefonia = [view]`
   - não há overrides em `user_permissions` removendo esses acessos
   - admins sem perfil vinculado ainda recebem os defaults do hook `usePermissions`
4. As policies de leitura também estão corretas para esse fluxo:
   - `system_modules`: leitura para autenticados
   - `tenant_modules`: leitura para usuários do próprio tenant
   Então RLS não é o bloqueio do sidebar.
5. Há divergência clara entre ambientes:
   - no preview, o RPC `get_my_enabled_modules()` retornou todos os módulos, incluindo `contact_center`, `telefonia` e `whatsapp`
   - na consulta direta do ambiente de produção, `system_modules` e `tenant_modules` continuam vazios
   Isso indica inconsistência entre o ambiente publicado/custom domain e o ambiente em que o preview está lendo os dados.

Plano de resolução
1. Corrigir primeiro a origem dos dados em produção
   - validar qual backend está atendendo `rivoconnect.com` e `rivoconnect.lovable.app`
   - popular diretamente em produção `system_modules` e `tenant_modules` para o tenant `39a450f8-7a40-46e5-8bc7-708da5043ec7`
   - revalidar no backend de produção o retorno de `get_my_enabled_modules()`

2. Ajustar a lógica do sidebar para ficar consistente com o catálogo de módulos
   - alinhar o mapeamento do “Contact Center” para não depender implicitamente de slugs diferentes
   - duas opções seguras:
     - usar `contact_center` como módulo pai real do grupo e manter `telefonia`/`whatsapp` como subtipos visuais
     - ou remover a ambiguidade e assumir oficialmente que o grupo depende de `telefonia` e `whatsapp`, não de `contact_center`
   Minha recomendação: manter `contact_center` como pai lógico e deixar os canais subordinados a ele, para evitar “módulo habilitado mas menu invisível”.

3. Endurecer a checagem para evitar novos falsos negativos
   - incluir fallback de diagnóstico no frontend quando:
     - o usuário tem permissão
     - mas `get_my_enabled_modules()` vier vazio
   - isso facilita identificar rapidamente se o problema é dados, sessão ou ambiente publicado

4. Não alterar as permissões do tenant agora
   - a revisão atual mostra que os perfis e defaults já liberam o acesso necessário
   - mudar permissões neste momento só mascara a causa real
   - só vale mexer nisso se quiser separar permissões de `whatsapp` e `telefonia` como módulos independentes no RBAC

5. Validar ponta a ponta em produção
   - login com o usuário afetado no domínio publicado
   - confirmar retorno de módulos ativos
   - confirmar exibição do grupo “Contact Center” no sidebar
   - abrir `/contact-center/telefonia` e `/contact-center/whatsapp`
   - repetir com admin e operador para garantir que módulo e permissão estão coerentes

Detalhes técnicos
- Arquivo-chave do problema visual: `src/components/AppLayout.tsx`
- Guard das rotas: `src/components/ModuleGuard.tsx`
- Resolução de permissões: `src/hooks/usePermissions.ts`
- Resolução de módulos por tenant: `src/hooks/useModules.ts`
- Conclusão técnica: hoje o problema aparenta ser de sincronização/provisionamento do ambiente publicado + inconsistência entre o slug `contact_center` e os slugs realmente usados pelo sidebar (`telefonia` e `whatsapp`), não de permissão do tenant.
