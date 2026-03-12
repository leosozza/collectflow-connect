

# Corrigir ranking vazio: backfill de dados existentes + auto-refresh

## Problema raiz

A tabela `operator_points` está **completamente vazia**. O trigger de gamificação (`useGamificationTrigger`) só é executado quando o operador cria um novo acordo ou registra um pagamento. Os 4 acordos do Vitor (e de outros operadores) foram criados **antes** da integração do trigger, então nunca foram contabilizados.

Dados reais no banco:
- **Vitor**: 3 acordos válidos + 1 cancelado = R$ 3.855,80
- **Maria Eduarda**: 1 acordo = R$ 1.333,80
- **Raul Seixas**: 1 acordo = R$ 702
- **Raul Jose**: 1 acordo = R$ 784

## Solução

### 1. Backfill via migração SQL

Criar uma migração que popula `operator_points` a partir dos dados existentes de `agreements` do mês atual. Isso resolve o problema imediato sem precisar que cada operador faça uma ação nova.

```sql
INSERT INTO operator_points (tenant_id, operator_id, year, month, points, payments_count, breaks_count, total_received)
SELECT p.tenant_id, p.id, 2026, 3,
  GREATEST(0, (COUNT(*) FILTER (WHERE a.status NOT IN ('rejected','cancelled'))) * 10 + FLOOR(SUM(...)/100)*5 - ...),
  COUNT(*) FILTER (WHERE a.status NOT IN ('rejected','cancelled')),
  COUNT(*) FILTER (WHERE a.status = 'cancelled'),
  COALESCE(SUM(a.proposed_total) FILTER (WHERE a.status NOT IN ('rejected','cancelled')), 0)
FROM agreements a JOIN profiles p ON p.user_id = a.created_by
WHERE EXTRACT(YEAR FROM a.created_at) = 2026 AND EXTRACT(MONTH FROM a.created_at) = 3
GROUP BY p.id, p.tenant_id
ON CONFLICT (tenant_id, operator_id, year, month) DO UPDATE SET ...
```

### 2. Auto-refresh na página de Gamificação

Em `src/pages/GamificacaoPage.tsx`, chamar `triggerGamificationUpdate()` ao montar a página. Isso garante que sempre que o operador acessar a aba de Gamificação, seus pontos sejam recalculados com dados atuais — resolvendo o problema para o futuro sem depender apenas dos triggers pontuais.

### 3. Auto-refresh no Dashboard (MiniRanking)

O `MiniRanking` no Dashboard também depende de `operator_points`. Adicionar o trigger lá também garante dados sempre frescos.

## Arquivos a alterar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Backfill de `operator_points` com dados existentes de março/2026 |
| `src/pages/GamificacaoPage.tsx` | Chamar `triggerGamificationUpdate()` no mount |
| `src/components/dashboard/MiniRanking.tsx` | Chamar `triggerGamificationUpdate()` no mount |

