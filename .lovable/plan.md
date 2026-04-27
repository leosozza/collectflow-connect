## Diagnóstico das campanhas — números errados

### Causas reais identificadas no banco

**1. Bug crítico de atribuição (`profile.id` ≠ `auth.uid`)**
O código assume que `profile.id == auth.uid` (comentário explícito em `campaignService.ts:279`). **Neste tenant é falso** — `profiles` tem coluna `user_id` apontando para outro UUID. Exemplos confirmados:

| Operador | `profiles.id` (usado hoje) | `profiles.user_id` (real auth.uid) |
|---|---|---|
| Maria Eduarda | c176575c… | 68e1d831… |
| Vitor | 030fd18d… | 4f875dc9… |
| Gustavo | 7873f5e6… | 33a1585b… |
| Sabrina | c734c47b… | 7766f9ab… |

Consequências:
- `maior_valor_recebido` filtra `clients.operator_id = profile.id` → **funciona por coincidência** (esse campo guarda o `profile.id`).
- `maior_valor_promessas`, `maior_qtd_acordos`, `negociado_e_recebido`, `menor_taxa/valor_quebra` filtram `agreements.created_by = profile.id` → **retornam 0** (`agreements.created_by` guarda o `auth.uid`). Por isso a CAMPANHA SEMANAL aparece toda zerada.

**2. "Maior valor recebido" só conta quitações totais, não parcelas pagas**
O metric soma `clients.valor_pago` filtrado por `data_quitacao` — só entra quando o cliente é totalmente quitado. Em abril/2026, para TESS:

- Via `clients.data_quitacao` (fonte atual): **R$ 7.565** total (Maria 4.091, Vitor 3.319, Gustavo 154).
- Via `manual_payments` confirmados (parcelas individuais quitadas): **R$ 64.675** total. Maria sozinha tem **R$ 10.667** em 54 parcelas pagas em abril que **não aparecem na campanha**.

A Maria realmente recebeu mais valor do que está sendo creditado, mas esse valor está em parcelas avulsas, não em quitações.

---

### Correções propostas

**Correção 1 — Resolver o auth.uid correto**
No `recalculateCampaignScores` (e no `useGamificationTrigger`), buscar `profiles.user_id` para cada `operator_id` antes de calcular, e passar esse valor como `authUid` (ao invés de reutilizar `profile.id`). Isso conserta automaticamente as métricas baseadas em `agreements.created_by` (semanal, qtd acordos, taxa/valor de quebra, negociado_e_recebido).

**Correção 2 — Ampliar `maior_valor_recebido` para incluir parcelas pagas**
Mudar a métrica para somar duas fontes (sem duplicar):

- `clients.valor_pago` onde `operator_id = profile.id` e `data_quitacao` na janela (mantém o que já funciona).
- `manual_payments.amount_paid` onde `status = 'confirmed'`, `payment_date` na janela, e o `agreement.created_by = auth.uid` do operador (atribui parcelas ao operador que negociou o acordo).

Filtros adicionais respeitados: tenant, credores vinculados à campanha (via `agreements.credor` para parcelas, `clients.credor` para quitações).

**Deduplicação**: como `manual_payments` reflete parcelas de acordos e `clients.data_quitacao` só dispara quando todas as parcelas são liquidadas, há sobreposição quando o cliente quita 100% no mês. Para evitar duplicar, vamos preferir `manual_payments` somado integralmente e **subtrair** do `clients.valor_pago` os clientes cujo CPF/credor já tem parcelas computadas no mesmo período. Alternativa mais simples: se houver parcelas pagas para o (CPF, credor) na janela, não somar de novo via `clients.valor_pago`.

**Correção 3 — Ajuste paralelo nas demais métricas**
Aplicada automaticamente pela Correção 1 (passam a usar `authUid` real). Sem mudanças adicionais de lógica.

---

### Arquivos a editar
- `src/services/campaignService.ts` — `recalculateCampaignScores` (resolver `user_id`) e `computeCampaignScore` (nova lógica de `maior_valor_recebido`).
- `src/hooks/useGamificationTrigger.ts` — `calculateCampaignScore` espelhar a lógica nova de `maior_valor_recebido` para o trigger em tempo real.

### Validação após implementação
1. Clicar "Recalcular Ranking" na CAMPANHA MENSAL → Maria deve mostrar valor próximo de R$ 14.7k (4.091 quitações + parcelas TESS), Vitor ~R$ 28k, Gustavo ~R$ 20k.
2. Clicar "Recalcular Ranking" na CAMPANHA SEMANAL (`maior_valor_promessas`) → operadores que criaram acordos em 27/04 passam a ter score > 0.
