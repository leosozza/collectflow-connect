

# Planos de Execução — Testes Financeiros (Pré-Produção)

Abaixo estão os planos organizados por prioridade. Você pode aprovar e executar um por vez.

---

## Plano 1: Validar fluxo completo de acordo (criação → pagamento → dashboard)

**Objetivo**: Garantir que um acordo criado reflete corretamente em todos os cards do Dashboard e no Analytics.

**Teste manual**:
1. Criar um acordo novo com entrada + parcelas
2. Editar o valor de uma parcela (testar `custom_installment_values`)
3. Confirmar pagamento via baixa manual
4. Verificar no Dashboard: cards Negociado, Recebido, Pendentes, Projetado
5. Verificar no Analytics: Taxa de Recuperação, Taxa de Conversão, gráfico de evolução

**O que validar no código**: Nenhuma mudança — é teste de regressão puro dos fixes recentes nas RPCs.

---

## Plano 2: Testar transição automática de acordo para "completed"

**Objetivo**: Verificar se quando todas as parcelas são pagas, o acordo transita automaticamente para `completed`.

**Verificação**:
- Analisar a Edge Function `auto-expire-agreements` e o callback `negociarie-callback` para confirmar que a lógica de quitação total existe
- Se não existir, implementar: quando `total_pago >= proposed_total`, o status deve mudar para `completed`

**Risco**: Se não há transição automática, acordos 100% pagos ficam como "pending/approved" para sempre, inflando as métricas.

---

## Plano 3: Testar webhook Negociarie (baixa automática via boleto)

**Objetivo**: Confirmar que pagamentos de boleto gerados pela Negociarie atualizam corretamente o `valor_pago` do cliente e registram o evento `payment_confirmed`.

**Verificação**:
- Analisar `negociarie-callback/index.ts` para confirmar que atualiza `clients.valor_pago`
- Confirmar que gera evento em `client_events` com `event_type = 'payment_confirmed'`
- Testar com um pagamento real ou simulado no ambiente de staging

---

## Plano 4: Validar cálculos com múltiplos credores

**Objetivo**: Garantir que filtros por credor no Dashboard e Analytics isolam corretamente os dados.

**Teste manual**:
1. Criar acordos para 2 credores diferentes
2. No Analytics, selecionar cada credor e verificar se os valores são isolados
3. Verificar se o card "Total Inadimplência" (carteira) reflete apenas o credor selecionado

---

## Plano 5: Testar limite de 1000 linhas

**Objetivo**: Confirmar que tenants com mais de 1000 clientes/acordos não perdem dados na UI.

**Verificação**:
- Confirmar que `fetchAllRows` está sendo usado em todas as queries críticas (Carteira, Analytics, Acordos)
- Se alguma query direta não usa paginação, corrigir

---

## Ordem de execução recomendada

| Ordem | Plano | Criticidade |
|---|---|---|
| 1 | Fluxo completo de acordo | Crítica |
| 2 | Transição automática completed | Crítica |
| 3 | Webhook Negociarie | Alta |
| 4 | Múltiplos credores | Média |
| 5 | Limite 1000 linhas | Média |

Escolha qual plano quer executar primeiro e eu faço a análise detalhada + implementação se necessário.

