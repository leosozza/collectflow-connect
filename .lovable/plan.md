

# Corrigir "Pagos" para mostrar apenas acordos completados

## Problema
Hoje a linha 299 soma `aprovados + pagos`, incluindo acordos apenas aprovados pelo admin (que ainda não foram pagos de fato). O credor só precisa ver os **efetivamente pagos** (`completed`).

## Alteração

### `src/components/relatorios/PrestacaoContas.tsx`

**Linha 299** — Trocar:
```typescript
{ label: "Pagos", value: acordosSummary.aprovados + acordosSummary.pagos },
```
Por:
```typescript
{ label: "Pagos", value: acordosSummary.pagos },
```

Isso faz "Pagos" refletir apenas `status === "completed"`. O campo `aprovados` continua calculado internamente mas não será exibido na prestação de contas.

