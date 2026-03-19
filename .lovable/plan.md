

# Reestruturação Visual do Menu de Telefonia

## Estrutura de Sub-grupos

Reorganizar as 16 abas flat em 4 grupos principais com sub-abas:

```text
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Dashboard  │  Campanhas  │  Chamadas   │  Controle   │
│  (principal)│  (principal)│  (principal)│  (principal) │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ · Gráficos  │ · Mailing   │ · Receptivo │ · Usuários  │
│ · Produtiv. │ · Rotas     │ · Agendamen.│ · Intervalos│
│             │             │             │ · Horários  │
│             │             │             │ · Qualific. │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

Remove: SMS, Bloqueio, Equipes (podem ser adicionados depois se necessário — ou posso mantê-los em Controle se preferir).

## Implementação Visual

**Arquivo:** `ThreeCPlusPanel.tsx`

1. **Barra principal**: 4 botões grandes com ícone + label (Dashboard, Campanhas, Chamadas, Controle) — estilo card/pill com destaque primário no ativo
2. **Sub-barra**: Quando um grupo é selecionado, mostra suas sub-abas abaixo em pills menores
3. **Navegação em 2 níveis**: Estado `activeGroup` + `activeTab` — grupo define quais sub-abas aparecem, tab define o conteúdo

## Itens removidos/realocados

- **SMS, Bloqueio, Equipes** — serão mantidos dentro de "Controle" como sub-abas extras para não perder funcionalidade

## Estrutura final de dados

```typescript
const groups = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, 
    tabs: [
      { value: "dashboard", label: "Visão Geral" },
      { value: "chart", label: "Gráficos" },
      { value: "agents-report", label: "Produtividade" },
    ]},
  { id: "campanhas", label: "Campanhas", icon: Megaphone,
    tabs: [
      { value: "campaigns", label: "Campanhas" },
      { value: "mailing", label: "Mailing" },
      { value: "routes", label: "Rotas" },
    ]},
  { id: "chamadas", label: "Chamadas", icon: PhoneCall,
    tabs: [
      { value: "history", label: "Histórico" },
      { value: "receptive", label: "Receptivo" },
      { value: "schedules", label: "Agendamentos" },
    ]},
  { id: "controle", label: "Controle", icon: Settings,
    tabs: [
      { value: "users", label: "Usuários" },
      { value: "intervals", label: "Intervalos" },
      { value: "office-hours", label: "Horários" },
      { value: "qualifications", label: "Qualificações" },
      { value: "teams", label: "Equipes" },
      { value: "blocklist", label: "Bloqueio" },
      { value: "sms", label: "SMS" },
    ]},
];
```

## Alterações

| Arquivo | Mudança |
|---|---|
| `ThreeCPlusPanel.tsx` | Redesign completo: navegação em 2 níveis (grupo + sub-aba), visual com cards para grupos principais e pills para sub-abas, manter todos os TabsContent existentes |

