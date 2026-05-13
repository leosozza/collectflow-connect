## Validação Fase 5.2 (Detalhe do Cliente lê SSOT)

| Verificação | Resultado |
|---|---|
| `agreement_installments` (parcelas pagas, não-canceladas) | **558** ✅ (era 556 — 2 novas baixas no período) |
| `agreements.paid_count` agregado bate com SSOT | ✅ |
| `agreement_installments` na publicação `supabase_realtime` | ✅ |
| `negociarie_cobrancas` na publicação `supabase_realtime` | ✅ |
| `AgreementInstallments.tsx` usa `fetchSSOTInstallments` + overlay | ✅ |
| Invalidação React Query nos write paths (manual / cancel / boleto) | ✅ |
| Nenhuma regressão de UI (mesmas colunas, mesmos badges) | ✅ |

**Conclusão:** Fase 5.2 está estável e não quebra nada. Sem divergências entre Lista de Acordos / Detalhe do Cliente / SSOT. Realtime ativo nas duas tabelas, fallback legado preservado. Pronto para 5.3.

---

## Faltam 2 sub-fases

| Fase | Status |
|---|---|
| 5.1 Dashboard SSOT | ✅ |
| 5.2 Detalhe do Cliente lê SSOT | ✅ |
| **5.3 Status consolidado da Carteira via SSOT** | 🟡 Próxima |
| 5.4 Shadow-check diário (auditoria) | ⏳ |

---

## Plano da Fase 5.3 — Status consolidado da Carteira via SSOT

### Diagnóstico atual

`get_carteira_grouped` agrupa por **CPF + Credor** e calcula o status do grupo a partir do campo `clients.status` (texto: `vencido | em_acordo | pendente | quebrado | pago`), com prioridade `vencido > em_acordo > pendente > quebrado > pago`.

**Problema:** `clients.status` é gravado por triggers e fluxos legados que olham para `manual_payments` + `negociarie_cobrancas` + `agreements` separadamente, e nem sempre refletem a SSOT (`agreement_installments`). Hoje ainda existe risco real de:

- CPF aparecer como **`vencido`** na Carteira mesmo com todas as parcelas materializadas como `paid` na SSOT.
- CPF aparecer como **`em_acordo`** quando o acordo já foi `quebrado` (parcela `overdue` há > N dias) na SSOT.
- CPF aparecer como **`pago`** quando ainda há `agreement_installments` não-canceladas pendentes (raro, mas observado em backfills).

A hierarquia oficial (memória `Status Hierarchy`) é:
`QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA DE ACORDO > INADIMPLENTE > EM DIA`

### Objetivo

Criar a função SSOT-canônica **`get_client_consolidated_status(_tenant_id uuid, _cpf text, _credor text)`** que retorne o status real do par CPF/Credor lendo direto de `agreement_installments` + `agreements` + `clients` (apenas para "tem dívida em aberto?"), seguindo a hierarquia oficial. Plugar essa função em `get_carteira_grouped` substituindo a leitura de `c.status` no nível de grupo.

### Mudanças

**Banco (1 migration)**

1. Função `get_client_consolidated_status(_tenant_id, _cpf, _credor) RETURNS text` (`STABLE SECURITY DEFINER`, `search_path=public`):
   - Olha `agreements` ativos do par (CPF, credor, tenant) com `status IN ('pending','approved')`.
   - Para cada acordo lê `agreement_installments` (SSOT):
     - `quitado`: todas as parcelas `paid OR cancelled` e existe ao menos uma `paid`.
     - `acordo_atrasado`: tem parcelas `overdue` mas atraso ≤ N dias (configurável; default 15) → ainda recuperável.
     - `quebra_acordo`: tem parcela `overdue` há > N dias OU `agreement.status='cancelled'`.
     - `acordo_vigente`: existem parcelas `pending` mas nenhuma vencida.
   - Se não há acordo ativo: olha `clients` do par para decidir entre `inadimplente` (`data_vencimento < today`) e `em_dia`.
   - Aplica hierarquia oficial e retorna o pior (mais grave) entre todos os acordos do par.

2. Função `get_carteira_grouped` passa a chamar `get_client_consolidated_status` no `SELECT` final do CTE `grouped` em vez de derivar de `f.status`. Mantém os mesmos valores textuais que o frontend já espera (mapeamento: `quitado→pago`, `acordo_vigente→em_acordo`, `acordo_atrasado→em_acordo`, `quebra_acordo→quebrado`, `inadimplente→vencido`, `em_dia→pendente`) — **zero mudança de contrato no frontend**.

3. Índice de apoio (se ainda não existir) em `agreement_installments(agreement_id, paid, cancelled, due_date)`.

**Frontend**

- Nenhuma mudança de UI. `CarteiraTable.tsx` continua recebendo `status` com os mesmos valores legados.
- Adicionar invalidação da query `["carteira-grouped"]` após write de pagamento manual / cancelamento de parcela (já invalidamos a SSOT — incluir esta key).

**Memória**

- Atualizar `installment-key-canonical.md` registrando que Carteira agora deriva status via SSOT.
- Atualizar Core memory `Status Hierarchy` com referência ao novo RPC como SSOT do status.

### Validação pós-deploy

Query comparativa em 100 CPFs aleatórios:

```sql
SELECT cpf, credor,
       legacy_status   = clients.status,
       canonical       = get_client_consolidated_status(tenant_id, cpf, credor)
FROM clients TABLESAMPLE BERNOULLI(2)
WHERE tenant_id = :t LIMIT 100;
```

Esperado: ≤ 5% de divergência, todas no sentido SSOT-correto (legado errava). Casos divergentes anotados para Fase 5.4 (shadow-check).

### Risco

Médio-baixo. Mudança contida em 1 RPC de leitura. Reversível com `DROP FUNCTION ... CASCADE` + redeploy da versão anterior de `get_carteira_grouped`. Nenhuma escrita, nenhum schema change destrutivo, nenhum reprocessamento.

### Performance

`get_client_consolidated_status` é chamado uma vez por grupo (≈ 50 grupos por página). Cada chamada faz 1-2 queries indexadas. Custo esperado: < 50ms adicional por página da Carteira. Se medirmos > 200ms, materializamos numa coluna `clients.consolidated_status_cached` atualizada por trigger (Fase 5.3.1, opcional).

---

Posso executar a Fase 5.3 agora?