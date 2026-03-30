

# Plano: Atualizar Roadmap com WhatsApp Fase 1 e Fase 2

## Problema
O roadmap não reflete as implementações recentes da Fase 1 do WhatsApp (campanhas, templates dedicados, disparo multi-instância, deduplicação, round-robin) nem a Fase 2 planejada (Meta oficial + IA).

## Mudanças no `src/pages/RoadmapPage.tsx`

### 1. Adicionar item **DONE** — WhatsApp Fase 1 (Disparo Não Oficial)
```typescript
{
  id: "whatsapp-fase1",
  title: "WhatsApp Fase 1 — Disparo Não Oficial",
  description: "Disparo em massa da carteira com múltiplas instâncias não oficiais, campanhas persistidas, deduplicação por CPF/telefone, round-robin, templates dedicados e logs por recipient.",
  status: "done",
  progress: 100,
  category: "Contact Center",
  lovablePrompt: "..."
}
```

### 2. Adicionar item **DONE** — Templates WhatsApp Dedicados
```typescript
{
  id: "whatsapp-templates",
  title: "Gestão de Templates WhatsApp",
  description: "Tabela dedicada de templates com categorias (cobrança, lembrete, acordo, geral), variáveis dinâmicas, preview e integração com disparo em massa.",
  status: "done",
  progress: 100,
  category: "Automação",
  lovablePrompt: "..."
}
```

### 3. Adicionar item **DONE** — Instâncias com categoria oficial/não-oficial
```typescript
{
  id: "whatsapp-instance-category",
  title: "Instâncias WhatsApp — Oficial/Não Oficial",
  description: "Seletor de categoria (oficial Meta / não oficial) na criação de instâncias, flags de capacidade e vinculação à régua de cobrança.",
  status: "done",
  progress: 100,
  category: "Integrações",
  lovablePrompt: "..."
}
```

### 4. Atualizar item existente `whatsapp-meta` (id "whatsapp-meta") de `future` para `planned`
- Renomear para "WhatsApp Fase 2 — API Oficial Meta + IA"
- Atualizar descrição para refletir que a base estrutural já está pronta
- Mudar status para `planned`, progress `10`

### 5. Adicionar item **DONE** — Vinculação de Instância à Régua
```typescript
{
  id: "regua-instance-link",
  title: "Vinculação de Instância à Régua",
  description: "Seletor de instância WhatsApp no formulário da régua de cobrança, com badge visual na timeline.",
  status: "done",
  progress: 100,
  category: "Automação",
  lovablePrompt: "..."
}
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/RoadmapPage.tsx` | Adicionar 4 itens done + atualizar whatsapp-meta para planned |

