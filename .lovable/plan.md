

# Plano: Simplificação Operacional do Módulo Telefonia

## Resumo

5 correções cirúrgicas: colapsar seções por padrão, remover aba Receptivo, filtrar apenas ativos em Usuários/Equipes, e manter click2call já funcional na ficha.

---

## 1. Iniciar Campanhas e Operadores colapsados

**AgentStatusTable.tsx** (linha 75): Mudar `useState(true)` → `useState(false)`

**CampaignOverview.tsx** (linha 25): Mudar `useState(false)` → `useState(true)` (nota: `collapsed=true` = seção fechada)

---

## 2. Remover aba Receptivo

**ThreeCPlusPanel.tsx**:
- Remover import de `ReceptiveQueuesPanel` (linha 16)
- Remover `PhoneIncoming` do import de ícones (linha 2)
- No grupo "chamadas" (linhas 38-44), remover `{ value: "receptive", label: "Receptivo", icon: PhoneIncoming }`
- Remover `receptive: <ReceptiveQueuesPanel />` do contentMap (linha 107)

O arquivo `ReceptiveQueuesPanel.tsx` será mantido no codebase (sem delete), apenas desvinculado da navegação.

---

## 3. Ligação direta pelo Atendimento (click2call)

O fluxo já existe e funciona em `AtendimentoPage.tsx` (linhas 293-316). O `handleCall` usa `click2call` via proxy, com validações de `agentId`, domínio/token e tratamento de erros. Não há dependência de fila receptiva.

**Nenhuma mudança necessária** — o fluxo já está implementado corretamente.

---

## 4. Usuários: mostrar apenas ativos por padrão

**UsersPanel.tsx** (linha 20): Mudar `useState("all")` → `useState("active")`

O filtro e a lógica `isUserActive` já existem. Apenas muda o valor inicial do select.

---

## 5. Equipes: mostrar apenas ativas por padrão

**TeamsPanel.tsx**: Adicionar filtro de status ativo similar ao UsersPanel.

A API retorna `status` ou `active` nos objetos de equipe. Filtrar equipes onde `team.active !== false && team.status !== 'inactive'` antes de renderizar. Adicionar Select de filtro (Ativas/Todas) com default "active".

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `AgentStatusTable.tsx` | `useState(true)` → `useState(false)` |
| `CampaignOverview.tsx` | `useState(false)` → `useState(true)` |
| `ThreeCPlusPanel.tsx` | Remover aba Receptivo da navegação |
| `UsersPanel.tsx` | Default filter "active" |
| `TeamsPanel.tsx` | Adicionar filtro ativo, default "active" |

## O que NÃO muda
- Click2call na ficha (já funciona)
- Gestão de campanhas
- Tabulação, monitoramento, histórico
- ReceptiveQueuesPanel.tsx (arquivo preservado, apenas desvinculado)

