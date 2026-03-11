

# Correção do Dashboard e Parcelas — Caso Fabíola

## Dados reais da cliente

- **Acordo**: entrada R$500 em 11/03/2026 + 2x R$101 (first_due_date: 11/04/2026)
- **Status do acordo**: approved
- **Títulos originais**: 1 pago (R$1800), 1 em_acordo (R$600)

## Bugs identificados

### Bug 1 — Parcela mostra "Vencido" no dia do vencimento (AgreementInstallments)

**Linha 100**: `const isOverdue = inst.dueDate < new Date()`

`new Date()` inclui hora atual (ex: 11/03 às 14h). Como `inst.dueDate` é criado com `T00:00:00`, a comparação `00:00 < 14:00` retorna `true` — marcando como "Vencido" no próprio dia do vencimento.

**Fix**: Comparar apenas datas, sem hora. Vencido = data anterior a hoje, não igual a hoje.

### Bug 2 — Parcela paga manualmente não reflete no status (AgreementInstallments)

O status da parcela virtual verifica `inst.cobranca?.status` (dados da integração Negociarie) mas não verifica pagamentos manuais registrados na tabela `clients`. Quando a baixa manual é feita, o `valor_pago` do título em `clients` é atualizado, mas o componente de parcelas não consulta isso.

**Fix**: Cruzar o valor pago dos títulos `clients` com as parcelas virtuais. Se `valor_pago >= valor_parcela` dos títulos em_acordo, marcar como pago.

### Bug 3 — RPC `get_dashboard_vencimentos` ignora a entrada

A RPC gera parcelas apenas com `generate_series(0, new_installments-1)` a partir de `first_due_date`. Mas a entrada (entrada_value/entrada_date) é armazenada separadamente e não é incluída.

Para Fabíola: entrada em 11/03/2026 com R$500 não aparece. A RPC começa em 11/04/2026.

**Fix**: Adicionar a entrada como parcela 0 na RPC quando `entrada_value > 0`.

## Plano de implementação

### 1. Migration SQL — Corrigir RPC `get_dashboard_vencimentos`

Recriar a função para incluir a entrada como primeira parcela:

```text
-- Parcela de entrada (quando entrada_value > 0)
UNION ALL
SELECT a.id, a.client_cpf, a.client_name, a.credor,
       0 AS numero_parcela,  -- 0 = entrada
       a.entrada_value AS valor_parcela,
       a.status
FROM agreements a
WHERE entrada_value > 0
  AND COALESCE(entrada_date, first_due_date)::date = _target_date

-- Parcelas regulares (existente, sem mudança)
```

### 2. Corrigir `AgreementInstallments.tsx` — Status correto

- **Linha 100**: Mudar comparação de data para ignorar horas:
  ```
  const today = new Date(); today.setHours(0,0,0,0);
  const dueDay = new Date(inst.dueDate); dueDay.setHours(0,0,0,0);
  const isOverdue = dueDay < today;
  ```

- **Status pago**: Buscar títulos `em_acordo` do CPF e cruzar `valor_pago` acumulado com parcelas virtuais para determinar quais já foram pagas.

### 3. Arquivos a editar

| Arquivo | Ação |
|---|---|
| Migration SQL | Recriar `get_dashboard_vencimentos` incluindo entrada |
| `src/components/client-detail/AgreementInstallments.tsx` | Corrigir comparação de data + detectar pagamento manual |

### Resultado esperado
- Entrada de R$500 (11/03) aparece no dashboard como vencimento do dia
- Parcela com vencimento hoje mostra "Em Aberto", não "Vencido"
- Parcela paga manualmente mostra "Pago" automaticamente

