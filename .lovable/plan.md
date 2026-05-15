
# Correção da Visão 360 — get_dashboard_stats

Reescrever a RPC `public.get_dashboard_stats` para alinhar as 4 métricas com a regra de negócio (verdade = status do acordo no banco, não janelas de "ansiedade" do dashboard).

## Mudanças por métrica

### 1. Colchão de Acordos
- **Hoje:** `status IN ('pending','approved')` → exclui `overdue`, faz cair durante o mês.
- **Novo:** `status NOT IN ('cancelled','rejected')` → inclui `overdue`. Mantém o filtro de 1ª parcela/entrada dentro do mês. Fica fixo no mês, só sai se cancelar.

### 2. Provisionado (Acordos Fechados no mês)
- **Hoje:** soma os 3 blocos (entrada + parcelas + à vista) com `AND status NOT IN ('cancelled','rejected')` → desce retroativamente quando há cancelamento.
- **Novo:** remover esse filtro de status nos 3 blocos. Passa a ser acumulador histórico puro por `created_at` no mês — só sobe.

### 3. Pendentes
- **Hoje:** usa `_pending_floor = CURRENT_DATE - 3` que descarta vencidos > 3 dias.
- **Novo:** remover `_pending_floor`. Filtro = `vencimento >= _month_start AND vencimento <= _month_end` com `status IN ('pending','approved','overdue')` e `NOT EXISTS` de pagamento. Acordo em atraso continua pendente; só sai se for `cancelled`.

### 4. Quebra de Acordos
- **Hoje:** dois ramos — (a) `_quebra_ceiling` força quebra antes do cancelamento, (b) `cancellation_type IN ('auto_expired','manual')` inclui erro de operador (acordo refeito).
- **Novo:** apenas um ramo — `status='cancelled' AND cancellation_type='auto_expired'`, mantendo `NOT EXISTS` de pagamento na parcela e o filtro de vencimento dentro do mês. Remover totalmente `_quebra_ceiling` e o ramo `manual`.

## Coerência matemática
- Total Previsto no mês = Colchão + Provisionado (sem dupla contagem: Colchão olha vencimento dentro do mês de acordos pré-existentes; Provisionado olha created_at no mês).
- Pendente ⊇ stand-by (vencidos não cancelados voltam a aparecer).
- Quebra ↓ (sai erro de operador e antecipação por janela).

## Implementação
Uma única migration: `CREATE OR REPLACE FUNCTION public.get_dashboard_stats(...)` com a mesma assinatura atual. Sem mudanças em UI (`Visao360Card.tsx`, `DashboardPage.tsx`).

## Riscos / efeitos esperados
- Provisionado de meses passados pode subir (cancelamentos antes excluídos voltam).
- Colchão sobe (overdue entra).
- Quebra cai (sem `manual`, sem antecipação por 3 dias).
- Pendentes sobe (stand-by retorna).

Tudo reflete a regra: a verdade é `agreements.status` + `cancellation_type`, e o dashboard para de antecipar.
