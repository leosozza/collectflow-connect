

# Plano: Separar Cancelamento Manual de Quebra Automática no Dashboard

## Problema

A RPC `get_dashboard_stats` soma **todos** os acordos com `status = 'cancelled'` no campo `total_quebra`. Isso inclui acordos cancelados manualmente pelo operador (renegociação, erro, desistência) — que não deveriam contar como quebra. Quebra real é apenas quando o sistema cancela automaticamente por falta de pagamento após o prazo configurado em `credores.prazo_dias_acordo`.

A coluna `cancellation_type` ainda **não existe** no banco. Precisa ser criada.

## Sobre o prazo de dias

Sim, o campo `credores.prazo_dias_acordo` já existe e é usado pela edge function `auto-expire-agreements` para decidir quando quebrar um acordo automaticamente. Ele é editável no Cadastro do Credor.

## Alterações

### 1. Migration: adicionar coluna `cancellation_type`

```sql
ALTER TABLE public.agreements ADD COLUMN cancellation_type text DEFAULT NULL;
COMMENT ON COLUMN public.agreements.cancellation_type IS 'manual = operador cancelou, auto_expired = sistema quebrou por falta de pagamento';
```

### 2. Edge Function `auto-expire-agreements/index.ts`

Na linha que cancela acordos vencidos (~linha 200), gravar `cancellation_type`:

```typescript
await supabase.from("agreements")
  .update({ status: "cancelled", cancellation_type: "auto_expired" })
  .in("id", ids);
```

### 3. Service `agreementService.ts` — `cancelAgreement()`

Marcar cancelamentos manuais (~linha 375):

```typescript
.update({ status: "cancelled", cancellation_type: "manual" })
```

### 4. RPC `get_dashboard_stats` — filtrar `_quebra`

Adicionar `AND a.cancellation_type = 'auto_expired'` nos dois blocos WHERE do cálculo de `_quebra` (entrada + parcelas regulares), para que apenas quebras automáticas sejam contabilizadas.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar coluna `cancellation_type` |
| `supabase/functions/auto-expire-agreements/index.ts` | Gravar `cancellation_type = 'auto_expired'` |
| `src/services/agreementService.ts` | Gravar `cancellation_type = 'manual'` |
| Migration SQL (RPC) | Atualizar `get_dashboard_stats` para filtrar por `auto_expired` |

Nenhuma alteração visual. Acordos cancelados pelo operador deixam de aparecer em "Total de Quebra".

