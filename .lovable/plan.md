

# Plano: Reestruturação dos Módulos do RiVO Connect

## Resumo

Reorganizar a tabela `system_modules` para refletir a nova hierarquia comercial, adicionar suporte a dependências entre módulos, e redesenhar a tela de gestão de módulos por tenant.

## Nova estrutura de módulos

| # | Slug | Nome | Categoria | is_core | parent_slug | depends_on |
|---|---|---|---|---|---|---|
| 1 | `crm` | CRM | core | true | — | — |
| 2 | `contact_center` | Contact Center | comunicacao | false | — | `crm` |
| 3 | `whatsapp` | WhatsApp | comunicacao | false | `contact_center` | `contact_center` |
| 4 | `telefonia` | Telefonia | comunicacao | false | `contact_center` | `contact_center` |
| 5 | `gamificacao` | Gamificação | engajamento | false | — | `crm` |
| 6 | `ia_negociacao_whatsapp` | IA Negociação WhatsApp | ia | false | — | `crm,contact_center,whatsapp` |
| 7 | `ia_negociacao_telefonia` | IA Negociação Telefonia | ia | false | — | `crm,contact_center,telefonia` |

Módulos **removidos da gestão** (absorvidos pelo CRM, sempre ativos se CRM ativo):
- `automacao`, `relatorios`, `financeiro`, `integracoes`, `api_publica`, `portal_devedor`, `ia_negociacao` (antigo)

## Mudanças por camada

### 1. Migration SQL — Reestruturar `system_modules`

- Adicionar colunas `parent_slug text` e `depends_on text[]` à tabela `system_modules`
- Renomear slug `crm_core` → `crm`
- Marcar os módulos absorvidos como `is_core = true` (sempre disponíveis, não aparecem na gestão)
- Inserir novos módulos `ia_negociacao_whatsapp` e `ia_negociacao_telefonia`
- Atualizar `depends_on` e `parent_slug` nos módulos existentes
- Atualizar sort_order para refletir a hierarquia
- Atualizar a RPC `get_my_enabled_modules` para incluir os novos slugs de módulos absorvidos como core

### 2. `src/services/moduleService.ts` — Adicionar campos e lógica de dependência

- Estender `SystemModule` com `parent_slug` e `depends_on`
- Criar função `getDependencyErrors(moduleId, enabledMap, modules)` que retorna lista de dependências não satisfeitas
- Criar função `getAutoDisableModules(moduleId, enabledMap, modules)` que retorna módulos que precisam ser desativados em cascata

### 3. `src/components/admin/TenantModulesTab.tsx` — Redesenhar UI com hierarquia

- Filtrar módulos `is_core` da listagem (ficam implícitos no CRM)
- Agrupar visualmente: módulos raiz e submódulos indentados
- Ao ativar um módulo, verificar se dependências estão satisfeitas; caso contrário, ativar automaticamente as dependências com toast informativo
- Ao desativar um módulo, desativar em cascata os dependentes com confirmação
- Adicionar seção de "Presets" no topo com botões: "Assessoria de Cobrança" e "Empresa Final"
- Preset aplica bulk toggle nos módulos correspondentes

### 4. `src/hooks/useModules.ts` — Compatibilidade com novos slugs

- `isModuleEnabled("automacao")` deve retornar `true` se CRM está ativo (manter compatibilidade)
- Mapear slugs absorvidos para CRM: `automacao`, `relatorios`, `financeiro`, `integracoes`, `api_publica`, `portal_devedor`
- Renomear referência interna de `crm_core` para `crm`

### 5. `src/components/AppLayout.tsx` — Simplificar sidebar

- Remover checks `isModuleEnabled("automacao")`, `isModuleEnabled("relatorios")` etc. — esses são sempre visíveis se CRM ativo (baseado em permissão apenas)
- Manter checks para `contact_center`, `whatsapp`, `telefonia`, `gamificacao`

### 6. `src/App.tsx` — Atualizar ModuleGuards

- `ModuleGuard module="automacao"` → manter (o hook retorna true se CRM ativo)
- `ModuleGuard module="integracoes"` → manter (idem)
- Nenhuma rota precisa mudar, apenas a lógica interna do hook

### 7. `src/components/admin/BulkModulesDialog.tsx` — Filtrar módulos absorvidos

- Não mostrar módulos `is_core` na seleção em massa

## Presets de ativação

**Assessoria de Cobrança:** CRM + Contact Center + WhatsApp + Telefonia + Gamificação + IA WhatsApp + IA Telefonia

**Empresa Final:** CRM + Contact Center + WhatsApp + Telefonia + IA WhatsApp + IA Telefonia

Ambos presets ativam os mesmos módulos técnicos. A diferença de experiência (menus simplificados) será preparada como campo `tenant_profile` em `tenants.settings` para evolução futura, sem implementar agora a customização visual por perfil.

## Garantias de não-quebra

- Todos os slugs antigos (`crm_core`, `automacao`, `relatorios`, etc.) continuam funcionando via mapeamento no `useModules`
- Nenhuma funcionalidade é removida — apenas reorganizada
- `ModuleGuard` e rotas permanecem intactos
- A migration usa `ON CONFLICT` e updates condicionais para não perder dados existentes de `tenant_modules`

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar colunas, reestruturar módulos, atualizar RPC |
| `src/services/moduleService.ts` | Campos novos, lógica de dependências |
| `src/components/admin/TenantModulesTab.tsx` | UI hierárquica, presets, cascata de ativação/desativação |
| `src/hooks/useModules.ts` | Mapeamento de compatibilidade para slugs absorvidos |
| `src/components/AppLayout.tsx` | Simplificar checks de módulos absorvidos no sidebar |
| `src/components/admin/BulkModulesDialog.tsx` | Filtrar módulos core da seleção |

