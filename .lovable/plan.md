

# Módulos ausentes na Sidebar para role `admin`

## Análise

Comparando o sistema de permissões (`usePermissions.ts`) com a sidebar (`AppLayout.tsx`), identifiquei que **vários módulos com permissões definidas para `admin` não aparecem na sidebar**:

| Módulo | Permissão definida para admin? | Na sidebar? |
|--------|-------------------------------|-------------|
| Dashboard | ✅ | ✅ |
| Gamificação | ✅ | ✅ |
| Carteira | ✅ | ✅ |
| Acordos | ✅ | ✅ |
| **Relatórios** | ✅ `["view"]` | ❌ **Ausente** |
| **Analytics** | ✅ `["view_all"]` | ❌ **Ausente** |
| Automação | ✅ | ✅ |
| Contact Center | ✅ | ✅ |
| Cadastros | ✅ | ✅ |
| **Financeiro** | ✅ `["view","manage"]` | ❌ **Ausente** |
| Configurações | ✅ | ✅ |
| Central Empresa | ✅ | ✅ |
| **Liberações** | ✅ `["view","approve"]` | ❌ **Ausente** |
| **Agendados** | ✅ `["view_own","view_all"]` | ❌ **Ausente** |
| **Campanhas WhatsApp** | ✅ (todas as ações) | ❌ **Ausente** |

São **6 módulos** que o admin tem permissão mas não consegue acessar pela sidebar. Isso explica a diferença entre o seu acesso (super_admin, que pode ter rotas extras) e o da Barbara (admin).

## Solução

### Arquivo: `src/components/AppLayout.tsx`

Adicionar na sidebar os links que faltam, controlados pelas permissões já existentes:

1. **Relatórios** — `permissions.canViewRelatorios` → `/relatorios` (ícone `FileBarChart`)
2. **Analytics** — `permissions.canViewOwnAnalytics` → `/analytics` (ícone `BarChart3`)
3. **Financeiro** — `permissions.canViewFinanceiro` → `/financeiro` (se a página existir como tenant-level, ou verificar se já está em Configurações)
4. **Liberações** — `permissions.canViewLiberacoes` → precisa confirmar se existe rota tenant-level
5. **Agendados** — `permissions.canViewOwnAgendados` → precisa confirmar se existe rota tenant-level
6. **Campanhas WhatsApp** — `permissions.canViewCampanhasWhatsApp` → pode ser sub-item do Contact Center ou item próprio

### Verificação necessária antes da implementação

Preciso verificar quais dessas rotas realmente existem em `App.tsx` para tenant-level (não admin). Já confirmei que `/relatorios` e `/analytics` existem. Para Financeiro, Liberações e Agendados, preciso verificar se há páginas correspondentes ou se estão embutidos em outras seções.

### Resultado

A Barbara (e qualquer admin) terá os mesmos itens na sidebar que o super_admin (exceto o painel Super Admin), bastando adicionar os links faltantes condicionados pelas permissões já definidas.

