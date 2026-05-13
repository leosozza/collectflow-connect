
## Validação Fase 5.1 (Dashboard)

| Verificação | Resultado |
|---|---|
| `agreement_installments` (SSOT) parcelas pagas | **556** |
| `SUM(agreements.paid_count)` (agregados) | **556** ✅ idêntico |
| Acordos com agregados populados | **706 / 706** ✅ |
| Valor recebido total via SSOT | **R$ 161.856,59** |
| RPC `get_dashboard_stats_v2` em produção | ✅ ativo no `DashboardPage.tsx` |
| RPC `get_financial_received_by_day` | ✅ disponível para `TotalRecebidoCard` |

Sem divergências. Trigger sem recursão. Fallback para legacy preservado.

## Faltam 3 sub-fases

| Fase | Status |
|---|---|
| 5.1 Dashboard SSOT | ✅ Concluída |
| **5.2 AgreementInstallments (Detalhe Cliente) lê SSOT** | 🟡 Próxima |
| 5.3 RPC `get_client_consolidated_status` (Carteira) | ⏳ |
| 5.4 Shadow-check diário (audit) | ⏳ |

---

## Plano da Fase 5.2 — Detalhe do Cliente lê da SSOT

**Objetivo:** o componente `AgreementInstallments.tsx` (na tela de detalhe do cliente) renderizar a lista de parcelas direto da tabela `agreement_installments` em vez de reconstruir tudo via classifier JS legado. Isso elimina a fonte mais comum de divergência entre "Lista de Acordos" e "Detalhe do Cliente".

### Mudanças

1. **Leitura nova (`fetchSSOTInstallments`)**
   - Já existe em `src/lib/agreementInstallmentsSSOT.ts` (criado na Fase 3).
   - Componente passa a chamar essa função e mapear cada linha da SSOT para o item visual (vencimento, valor, status `paid|pending|overdue|cancelled`, fonte `manual|negociarie|cobcloud`).

2. **Fallback automático**
   - Se a SSOT vier vazia para um acordo (caso muito raro de acordo recém-criado antes da trigger), cai no classifier legado. Logamos `console.warn` com o `agreement_id` para auditoria.

3. **Ações de escrita (intocadas)**
   - "Marcar como pago manual" → continua escrevendo em `manual_payments`
   - "Cancelar parcela" → continua em `cancelled_installments`
   - "Gerar boleto" → continua em `negociarie_cobrancas`
   - Após qualquer ação, invalida o cache do React Query da SSOT do acordo. Trigger já reconstrói automaticamente.

4. **UI sem mudança visual**
   - Mesmas colunas, mesmos badges, mesmas cores. O usuário não percebe nada — só passa a sempre ver o estado canônico.

### Arquivos afetados

- `src/components/client-detail/AgreementInstallments.tsx` (leitura)
- Nada no banco (não há migration nesta sub-fase).
- Memória: atualizar `installment-key-canonical.md` registrando que Detalhe do Cliente agora consome SSOT.

### Risco

Baixo. Reversível com 1 commit. Sem schema change. Sem reprocessamento.

### Validação pós-deploy

Comparar 5 acordos aleatórios entre Lista de Acordos / Detalhe do Cliente / SSOT — devem mostrar exatamente os mesmos números de parcelas pagas e mesmas datas.

---

Posso executar a Fase 5.2 agora?
