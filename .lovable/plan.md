
# Fase 5 — Propagação da SSOT e início da SSOT de status

## Estado atual (validado)

| Fonte | Pagas | Total |
|---|---|---|
| `agreement_installments` (SSOT) | 556 | 3.235 |
| `agreements.paid_count/total_count` (agregados) | 556 | 3.235 |

704/704 acordos com agregados populados. Trigger de recursão eliminada. Frontend de `/acordos` já lê os agregados (com fallback para SSOT).

## Pontos ainda inconsistentes no sistema

Mapeei 3 lugares onde "está pago?" e "quantas parcelas pagas?" ainda são calculados em runtime ou lidos de fontes secundárias:

1. **Dashboard** (`TotalRecebidoCard` e congêneres) — soma valores pagando direto de `manual_payments` + `negociarie_cobrancas`. Pode divergir da SSOT em casos de borda (parcela cancelada, pagamento duplicado, anti-leak).
2. **Detalhe do Cliente** (`AgreementInstallments.tsx`) — usa o classifier JS legado para renderizar a lista de parcelas. Funciona, mas duplica regra que já existe no SSOT.
3. **Carteira** (status QUITADO/ACORDO VIGENTE/ACORDO ATRASADO/QUEBRA) — calculado por hierarquia em runtime, lendo `agreements.status` + `clients.valor_pago`. Não considera o estado real da SSOT.

## Plano da Fase 5

### 5.1 — Dashboard lê agregados (zero query extra)
- `TotalRecebidoCard` e widgets de "acordos quitados", "acordos vigentes", "parcelas em atraso" passam a ler de `agreements.paid_count`, `total_count`, `overdue_count`, `last_paid_at`, `next_due_date`.
- Cálculo de "valor recebido total" passa a usar `SUM(paid_amount) FROM agreement_installments WHERE paid AND tenant_id=X` via uma RPC nova `get_dashboard_received_totals(tenant_id, from, to)` — uma única consulta indexada, em vez de varrer manual_payments + negociarie_cobrancas no cliente.
- Risco visível: zero. Mantemos os mesmos rótulos. Se número divergir, é porque a SSOT está mais correta (anti-leak).

### 5.2 — `AgreementInstallments` (Detalhe do Cliente) lê SSOT
- Componente passa a renderizar a lista de parcelas direto da `agreement_installments` em vez de reconstruir via classifier.
- Ações ("gerar boleto", "marcar pago manual", "cancelar parcela") continuam batendo nas tabelas de origem (`manual_payments`, `cancelled_installments`) — só mudou a leitura.
- Garante que a UI sempre mostra exatamente o que a SSOT diz. Fim das divergências entre "lista de Acordos" e "Detalhe do Cliente".

### 5.3 — RPC unificada de status por CPF/Credor
- Cria função `get_client_consolidated_status(tenant_id, cpf, credor)` que aplica a hierarquia (QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA > INADIMPLENTE > EM DIA) lendo da SSOT — não mais do `clients.valor_pago`.
- **Não mexe em `clients.status` ainda** — só expõe a função. Carteira pode adotá-la opcionalmente em uma sub-fase.
- Backfill: nenhum (função é stateless).

### 5.4 — Shadow-check (opcional, recomendado)
- Edge function `agreements-aggregates-audit` que roda 1x/dia e compara, por amostragem de N acordos:
  - `agreements.paid_count` vs contagem ao vivo na SSOT
  - SSOT vs classifier JS legado
- Loga divergências em `audit_logs` com `action='ssot_drift_detected'`.
- Se 7 dias com 0 divergência, podemos aposentar o classifier JS com confiança.

## Ordem de execução proposta

| Sub-fase | Risco | Reversível? |
|---|---|---|
| 5.1 Dashboard | Baixo (RPC adicional, leitura migrada) | Sim, voltar ao path antigo |
| 5.2 AgreementInstallments | Baixo (só leitura) | Sim |
| 5.3 RPC status consolidado | Zero (função nova, não consumida) | Sim, drop function |
| 5.4 Shadow-check | Zero | Sim |

Posso seguir direto na 5.1 (Dashboard), que é a que dá ganho mais visível e crítico para confiança no número de "valor recebido".

## Garantias preservadas

- Nenhuma coluna removida.
- `agreements.status` legado intocado.
- Pagamentos antigos, baixas, quebras: sem reprocessamento.
- Frontend mantém os mesmos componentes, mesmos rótulos, mesmas cores.
- `manual_payments` / `negociarie_cobrancas` continuam sendo as tabelas de escrita (ações do operador). Só a leitura para "está pago?" passa a ser SSOT.
