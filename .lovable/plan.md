## Diagnóstico

Investigando o caso da Renata Cibin (acordo `c396d78e…`), encontrei dois problemas independentes que explicam o que você está vendo:

### 1. Pagamento veio do Negociarie, não de baixa manual

Na tabela `negociarie_cobrancas` há:
```
status: pago | valor: 1041,33 | valor_pago: 1043,41 | data: 2026-04-21
```
Não existe nenhum registro em `manual_payments` para esse acordo.

Hoje, o botão "Desconfirmar Pagamento" (ícone $ azul) em `AgreementInstallments.tsx` (linha 796) só aparece quando existe um `manual_payment` confirmado:
```ts
const hasConfirmedManual = manualPayments.some(
  (mp) => mp.installment_number === inst.number && mp.status === "confirmed"
);
return hasConfirmedManual ? (...botão...) : null;
```
Como o pagamento veio via boleto Negociarie, a condição é `false` → nenhum botão de estorno é renderizado. **Não há hoje nenhuma ação na UI para estornar/cancelar uma cobrança paga do Negociarie.**

### 2. `reopenAgreement` está colocando o acordo em `pending` (Aguardando Aprovação), não em `approved` (Vigente)

Em `src/services/agreementService.ts` linha 826:
```ts
.update({ status: "pending", cancellation_type: null })
```
Como combinamos no plano anterior, o esperado é voltar para `approved` ("Vigente").

### 3. Efeito no Dashboard do operador

Os KPIs financeiros (`get_dashboard_stats`, `TotalRecebidoCard`, ranking) somam pagamentos de:
- `manual_payments` confirmados
- `client_events` do tipo `payment_confirmed`
- `negociarie_cobrancas` com status `pago`

Para "sumir" esse R$ 1.041,33 do dashboard ao estornar, basta marcar a cobrança Negociarie como **estornada** (não-pago). É isso que precisamos implementar.

---

## O que vou implementar

### A) Botão "Estornar Pagamento" para parcelas pagas via Negociarie

Em `AgreementInstallments.tsx`, adicionar uma segunda condição ao bloco de botões de "Desconfirmar":
- Se a parcela tem `cobranca.status === "pago"` (Negociarie) **OU** tem `manual_payment` confirmado, mostrar o botão $ azul.
- Comportamento ao clicar:
  - **Se baixa manual**: mantém o fluxo atual (`status → pending_confirmation`).
  - **Se cobrança Negociarie paga**: chama um novo handler `handleRefundCobranca` que faz `UPDATE negociarie_cobrancas SET status='estornado', valor_pago=0, data_pagamento=null WHERE id=...` e registra evento `payment_refunded` em `client_events`.
- Diálogo de confirmação: "Tem certeza que deseja estornar este pagamento? O valor sairá das métricas do operador e do dashboard."

### B) Excluir cobranças `estornado` da contabilização do dashboard e do total do acordo

- `AgreementInstallments.tsx` linha 133: `cobrancas.filter(c => c.status === "pago")` — já filtra só pagos, então `estornado` sairá automaticamente. ✓
- Verificar/ajustar a RPC `get_dashboard_stats` e queries de ranking para que filtrem `negociarie_cobrancas.status = 'pago'` (provavelmente já fazem; se não, adicionar `AND status = 'pago'`).
- O evento `payment_refunded` no `client_events` permite auditoria sem afetar o KPI "Acionados Hoje".

### C) Corrigir o status pós-reabrir para `approved` (Vigente)

Em `src/services/agreementService.ts` linha 826, trocar:
```ts
.update({ status: "pending", cancellation_type: null })
```
por:
```ts
.update({ status: "approved", cancellation_type: null })
```

### D) Permitir reabrir acordos `pending` também

Hoje, depois desse fix, se a Renata permanecer em `pending`, o botão "Reabrir" (ClientDetailPage linha 641) só funciona em `cancelled`/`completed`. Como ela já está `pending` agora, vou adicionar `pending` à lista temporariamente — **ou** criar um botão "Forçar Vigente" para casos órfãos. Recomendo: adicionar uma migration única para subir esse acordo específico para `approved` e seguir.

---

## Fluxo final que você terá

1. Acordo está como **Acordo Vigente** ✓ (após corrigir o status).
2. Na tabela de parcelas do acordo, ao lado da parcela "Pago", aparecerá um ícone **$ azul** = "Estornar Pagamento".
3. Ao clicar, confirmação → cobrança Negociarie vira `estornado`, valor sai das métricas.
4. A parcela volta a aparecer como **"Pendente"** (porque `totalPaidFromClients` reduz).
5. Você pode então cancelar o acordo e refazer corretamente.

---

## Arquivos a editar

- `src/components/client-detail/AgreementInstallments.tsx` — adicionar handler `handleRefundCobranca` e expandir condicional do botão de estorno.
- `src/services/agreementService.ts` — trocar `status: "pending"` por `status: "approved"` no `reopenAgreement`.
- Migration única para corrigir o acordo `c396d78e-1651-4dfa-89b7-2de89478576e` para `approved`.
- (Verificação) RPCs `get_dashboard_stats` e similares — confirmar que filtram só `status = 'pago'` em `negociarie_cobrancas`.

Confirma esse plano?