

# Plano: Campos de destaque no cabeçalho do atendimento (2 níveis)

## Resumo

Evoluir a configuração existente de campos do atendimento para suportar 2 níveis: até 4 campos "destacados" aparecem no cabeçalho principal (junto com os fixos: Nome, Status, CPF, Credor), e os demais aparecem apenas no expandido "Mais informações do devedor", sem duplicidade.

## Modelagem: Antiga vs Nova

```text
ANTIGA: visible (boolean) + sort_order (int)
        → campo visível ou invisível no expandido

NOVA:   is_highlighted (boolean, default false) + sort_order (int)
        → visible é descartado
        → is_highlighted = true → aparece no bloco principal (máx 4)
        → is_highlighted = false → aparece no expandido
        → todos os campos sempre existem, não há mais "invisível"
```

## Migração SQL

1. Adicionar coluna `is_highlighted BOOLEAN NOT NULL DEFAULT false`
2. Migrar dados: os 4 primeiros campos com `visible = true` (por `sort_order`) de cada `credor_id` recebem `is_highlighted = true`
3. Coluna `visible` mantida por segurança (não será mais usada no código)

## Alterações por Arquivo

### 1. Migration SQL (nova)
- `ALTER TABLE atendimento_field_config ADD COLUMN is_highlighted BOOLEAN NOT NULL DEFAULT false`
- UPDATE para migrar os 4 primeiros visíveis por credor como highlighted

### 2. `src/services/atendimentoFieldsService.ts`
- Adicionar `is_highlighted: boolean` à interface `FieldConfig`
- Nova função `setHighlighted(id: string, is_highlighted: boolean)`
- Nova função `setHighlightedBatch(credorId: string, highlightedIds: string[])` — seta `is_highlighted = true` nos IDs fornecidos e `false` nos demais do mesmo credor (máx 4 validado no frontend)
- Remover `toggleFieldVisibility` (substituída)
- `seedDefaultFields`: campos criados com `is_highlighted = false` por padrão

### 3. `src/components/cadastros/AtendimentoFieldsConfig.tsx`
Reescrever a UI:
- **Bloco 1 — Campos sempre visíveis**: Bloco informativo (read-only) listando Nome, Status, CPF, Credor com texto explicativo
- **Bloco 2 — Campos extras no cabeçalho**: Lista dos campos disponíveis com checkbox/switch para marcar até 4 como destacados. Contador "X de 4 selecionados". Drag-to-reorder ou setas para ordenar os selecionados
- **Texto explicativo**: "Os campos não selecionados continuarão visíveis ao expandir 'Mais informações do devedor'."
- Remover conceito de visível/invisível

### 4. `src/components/atendimento/ClientHeader.tsx`
- Separar `visibleFields` em dois grupos:
  - `highlightedFields`: campos com `is_highlighted === true` (máx 4), renderizados no bloco principal entre as info fixas e os stats financeiros
  - `expandedFields`: todos os campos com `is_highlighted === false`, renderizados no `CollapsibleContent`
- Fallback: se nenhuma config existe, mostrar os 4 primeiros campos padrão (phone, email, valor_saldo, valor_atualizado) como highlighted
- Sem alteração em props operacionais (onCall, onHangup, hasActiveCall, onNegotiate, hangingUp)

## Layout do Cabeçalho (Novo)

```text
┌─────────────────────────────────────────────────┐
│ [Avatar] Nome          [STATUS]    Em Aberto │ Pago │ Atraso │ [DESLIGAR] [WA] [ACORDO] │
│          CPF: xxx  |  Credor: xxx                                                       │
│                                                                                          │
│  📞 Telefone 1    📧 E-mail    💰 Valor Saldo    📄 Cód. Contrato   ← até 4 destacados │
│                                                                                          │
│  ─── Mais informações do devedor ▼ ──────────────────────────────────────────────────── │
│  (expandido: todos os demais campos, sem duplicar os 4 acima)                           │
└─────────────────────────────────────────────────┘
```

## O que NÃO muda

- Props operacionais do ClientHeader
- AtendimentoPage, NegotiationPanel, AgreementCalculator
- Telefonia, WhatsApp, tabulação, timeline
- Fluxo de acordo e boleto
- Nenhum outro componente além dos 4 listados

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Adicionar `is_highlighted`, migrar dados |
| `src/services/atendimentoFieldsService.ts` | Interface + funções de highlight |
| `src/components/cadastros/AtendimentoFieldsConfig.tsx` | Nova UI com 2 blocos + limite de 4 |
| `src/components/atendimento/ClientHeader.tsx` | Renderizar highlighted no topo, restante no expandido |

