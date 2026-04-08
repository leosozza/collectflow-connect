

# Padronização de Status — Plano de Implementação

## Resumo

Renomear "Aguardando acionamento" → "Inadimplente", adicionar "Acordo Atrasado", refatorar `auto-status-sync` para lógica CPF-centric com hierarquia clara, atualizar RPC de vencimentos com verificação granular de pagamentos, e corrigir labels na UI.

## 1. Banco de Dados (2 migrations)

### Migration A — Renomear status + adicionar "Acordo Atrasado"
```sql
-- Renomear em todos os tenants
UPDATE tipos_status SET nome = 'Inadimplente' WHERE nome = 'Aguardando acionamento';

-- Adicionar "Acordo Atrasado" para tenants que não têm
INSERT INTO tipos_status (tenant_id, nome, descricao, cor, icone, regras)
SELECT t.id, 'Acordo Atrasado', 'Acordo com parcela vencida sem pagamento', 'destructive', 'Clock', '{}'::jsonb
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tipos_status ts WHERE ts.tenant_id = t.id AND ts.nome = 'Acordo Atrasado'
);
```

### Migration B — Atualizar RPC `get_dashboard_vencimentos`
Adicionar LEFT JOIN na `manual_payments` para verificar se cada parcela específica tem pagamento confirmado. Se sim, retornar status `paid` para aquela parcela, mesmo que o acordo global seja `pending`.

```text
Lógica:
- JOIN com manual_payments ON agreement_id + installment_number
- WHERE mp.status = 'confirmed'
- Retornar coluna extra: effective_status (paid/pending/overdue)
```

## 2. Edge Function `auto-status-sync` — Refatoração CPF-Centric

Reescrever a lógica para:
1. Buscar TODOS os clients do tenant agrupados por CPF+Credor
2. Para cada grupo, consultar agreements associados
3. Aplicar hierarquia:
   - **Quitado**: todas parcelas pagas E todos acordos `approved`
   - **Acordo Vigente**: existe acordo `pending`
   - **Acordo Atrasado**: existe acordo `overdue`
   - **Quebra de Acordo**: último acordo `cancelled`
   - **Inadimplente**: parcelas vencidas sem acordo ativo (antigo "Aguardando acionamento")
   - **Em dia**: nada vencido
4. Manter lógica de expiração de "Em negociação"
5. Usar `statusMap.get("Inadimplente")` em vez de `"Aguardando acionamento"`

## 3. UI — Labels e Nomenclatura

### `src/pages/ClientDetailPage.tsx` (linha 45)
```
overdue: "Vencido" → overdue: "Acordo Atrasado"
cancelled: "Cancelado" → cancelled: "Quebra de Acordo"
```

### `src/pages/DashboardPage.tsx` (linha 320)
Já está correto: "Pago" (verde), "Atrasado" (vermelho), "Pendente" (laranja). Apenas ajustar label "Atrasado" → "Acordo Atrasado" para consistência.

### `src/components/cadastros/TipoStatusList.tsx` (linha 18)
Atualizar DEFAULT_STATUS: `"Aguardando acionamento"` → `"Inadimplente"` e adicionar "Acordo Atrasado" na lista.

### `src/services/agreementService.ts` (linha 412)
Trocar `"Aguardando acionamento"` → `"Inadimplente"`.

### `src/components/client-detail/ClientUpdateHistory.tsx`
Label já está "Status Cobrança" — mudar para "Status do Cliente".

### `src/components/client-detail/ClientDetailHeader.tsx`
Já está como "Status do Cliente" (linha 477) — sem alteração necessária.

## 4. Fix de Build — `process-email-queue/index.ts`

Verificar se o cast `as any` já foi aplicado na última alteração. Se ainda houver erros de tipo, aplicar em todas as chamadas `.from('email_send_log')` e `.rpc('move_to_dlq')`.

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL (dados) | Renomear status + inserir "Acordo Atrasado" |
| Migration SQL (RPC) | `get_dashboard_vencimentos` com pagamentos granulares |
| `auto-status-sync/index.ts` | Refatoração CPF-centric + nova hierarquia |
| `ClientDetailPage.tsx` | Labels: overdue→"Acordo Atrasado", cancelled→"Quebra de Acordo" |
| `DashboardPage.tsx` | Label "Atrasado"→"Acordo Atrasado" |
| `TipoStatusList.tsx` | DEFAULT_STATUS atualizado |
| `agreementService.ts` | "Aguardando acionamento"→"Inadimplente" |
| `ClientUpdateHistory.tsx` | Label "Status Cobrança"→"Status do Cliente" |
| `process-email-queue/index.ts` | Verificar/corrigir build |

## Riscos e Mitigações

- **Regras de auto_transicao**: O campo `regras.auto_transicao` em "Em negociação" pode conter `"Aguardando acionamento"`. A migration de dados deve atualizar isso para `"Inadimplente"` no campo JSON.
- **Timeout**: A refatoração CPF-centric pode ser mais pesada. Usaremos batches de 500 CPFs e queries otimizadas.
- **Nenhuma tabela nova**: Apenas renomeação de valores e ajuste de lógica.

