

## Reformulacao Completa do Painel Super Admin + Limpeza de Navegacao

### 1. Remover abas nao funcionais da navegacao lateral

**Arquivo: `src/components/AppLayout.tsx`**

Remover do array `advancedNavItems`:
- "Configuracoes" (`/configuracoes`)
- "Automacao" (`/automacao`)
- "Log de Importacoes" (`/cadastro`)
- "Auditoria" (`/auditoria`)

Renomear "Empresa" para "Configuracoes Empresa" no mesmo array.

O array `advancedNavItems` ficara com apenas 1 item:
```
{ label: "Configuracoes Empresa", icon: Building2, path: "/tenant/configuracoes" }
```

Como sobra apenas 1 item, o collapsible "Avancado" pode ser removido e o item fica direto na navegacao principal.

Atualizar tambem o `pageTitles` no header para refletir o novo nome.

---

### 2. Reformular pagina Super Admin (`/admin/tenants`) com abas

**Arquivo: `src/pages/SuperAdminPage.tsx`** - reescrever completamente

A pagina tera 3 abas: **Dashboard**, **Empresas** (ativas + excluidas), **Link de Cadastro**.

#### Aba Dashboard
- KPI Cards: Total Empresas, Ativas, Suspensas, Excluidas, Receita Mensal Estimada (soma dos planos + servicos ativos)
- Grafico simples de empresas criadas por mes (ultimos 6 meses)
- Lista das ultimas 5 empresas criadas

#### Aba Empresas
Sub-abas: **Ativas** | **Excluidas**

**Ativas:** Tabela com colunas: Empresa, Plano, Status, Servicos Ativos, Criado em, Acoes (Gerenciar Servicos, Suspender, Excluir)

**Ao clicar em "Gerenciar Servicos":** Abre um Dialog/Sheet com toggles para liberar funcionalidades para o tenant:
- Agente de IA Digital (valor: "A definir")
- Negativacao Serasa/Protesto (valor: "A definir")
- WhatsApp (R$ 99,00/mes - inclui 1 instancia + 1 agente IA)
- Instancias WhatsApp adicionais (R$ 49,00 cada)
- Assinatura Digital (valor: "A definir")

Os servicos liberados sao salvos em `tenants.settings.enabled_services` (objeto com chaves booleanas). Quando o tenant admin acessar a aba Servicos em `/tenant/configuracoes`, os servicos ja habilitados pelo super admin aparecem como ativos. Os servicos nao habilitados ficam disponiveis para autocontratacao com confirmacao de valor.

**Ao clicar em "Excluir":** AlertDialog perguntando "Tem certeza que deseja excluir esta empresa?" - ao confirmar, muda status para `deleted` (soft delete).

**Excluidas:** Tabela de empresas com status `deleted`, com opcao de buscar por CNPJ/CPF e botao "Reativar".

#### Aba Link de Cadastro
- Gera uma URL do tipo `{origin}/onboarding?ref=superadmin` que pode ser copiada e enviada para novos clientes
- Botao de copiar URL com feedback visual
- Explicacao: "Envie este link para novos clientes. Ao acessarem, poderao criar sua empresa e escolher um plano diretamente."

---

### 3. Atualizar TenantSettingsPage - integrar servicos liberados

**Arquivo: `src/pages/TenantSettingsPage.tsx`**

Na aba "Servicos":
- Ler `tenant.settings.enabled_services` para saber quais servicos o super admin ja liberou
- Servicos ja liberados aparecem com badge "Incluso" e switch ativo/desativado
- Servicos nao liberados aparecem com o valor e um botao "Contratar" que abre AlertDialog de confirmacao com texto: "O valor de R$ XX,XX sera adicionado a sua proxima fatura. Deseja continuar?"
- Ao confirmar, o servico e ativado em `settings.services`

Atualizar o array SERVICOS com os novos valores:
- WhatsApp: R$ 99,00/mes (inclui 1 instancia + 1 agente)
- Instancia WhatsApp adicional: R$ 49,00/cada
- Agente IA Digital: "A definir"
- Negativacao: "A definir"
- Assinatura Digital: "A definir"

---

### 4. Migracao SQL

Adicionar coluna `cnpj` e `deleted_at` na tabela `tenants`:

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
```

Isso permite:
- Busca por CNPJ na aba de excluidos
- Soft delete com timestamp

---

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/components/AppLayout.tsx` - remover 4 itens do menu, renomear Empresa, remover collapsible Avancado
- `src/pages/SuperAdminPage.tsx` - reescrever com 3 abas (Dashboard, Empresas, Link de Cadastro)
- `src/pages/TenantSettingsPage.tsx` - integrar servicos liberados pelo super admin, novos valores
- Nova migracao SQL para adicionar `cnpj` e `deleted_at` em tenants

**Nenhuma nova dependencia necessaria.**

