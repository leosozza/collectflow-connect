

# Plano: Mostrar nome do operador e tipo específico nas disposições do histórico

## Problemas

1. **Título genérico**: A disposição aparece como "Disposição" ao invés de "Caixa Postal", "Não Atende", etc. Isso porque a linha 250 do `ClientTimeline.tsx` resolve `EVENT_TYPE_LABELS["disposition"]` primeiro, que retorna "Disposição". Deveria priorizar `DISPOSITION_TYPES[event_value]`.

2. **Nome do operador ausente**: O trigger `trg_client_event_from_disposition` não inclui `operator_id` no campo `metadata` do `client_events`. Sem o `operator_id`, o frontend não consegue resolver o nome.

## Correções

### 1. Migration SQL — Incluir `operator_id` no trigger de disposição

Atualizar `trg_client_event_from_disposition` para incluir `operator_id` no `metadata`:

```sql
jsonb_build_object(
  'notes', NEW.notes,
  'scheduled_callback', NEW.scheduled_callback,
  'operator_id', NEW.operator_id
)
```

### 2. `src/components/atendimento/ClientTimeline.tsx`

**Linha 250** — Para disposições, priorizar o label específico:
```typescript
// De:
const label = EVENT_TYPE_LABELS[eventType] || DISPOSITION_TYPES[e.event_value] || eventType;
// Para:
const label = eventType === "disposition"
  ? (DISPOSITION_TYPES[e.event_value] || e.event_value || "Disposição")
  : (EVENT_TYPE_LABELS[eventType] || e.event_value || eventType);
```

**Linhas 210-218** — Incluir `meta.operator_id` na coleta de IDs para resolver nomes:
```typescript
if (meta?.operator_id) userIds.add(meta.operator_id);
```

**Linhas 256-262** — Adicionar fallback para `meta.operator_id`:
```typescript
if (meta.operator_id && profileMap[meta.operator_id]) {
  operator = profileMap[meta.operator_id];
}
```

## Arquivos

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar `operator_id` ao metadata do trigger de disposição |
| `src/components/atendimento/ClientTimeline.tsx` | Priorizar label específico da disposição; resolver nome do operador via `operator_id` do metadata |

