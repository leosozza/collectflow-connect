

# Plano: Score de Propensão Comportamental (sem nova dimensão)

## Resumo

Ajustar a edge function `calculate-propensity` para que o score represente propensão real de fechamento de acordo, baseado exclusivamente em comportamento observado. Cliente sem histórico começa em 0. Sem nova dimensão, sem score financeiro separado, sem alteração de banco.

## Alterações no arquivo `supabase/functions/calculate-propensity/index.ts`

### 1. Score 0 para clientes sem histórico (linha 40-49)

Alterar o bloco `if (events.length === 0)` para retornar `score: 0` e `score_reason: "Sem histórico de interação"`.

### 2. Remover base fixa +10 do cálculo (linha 181)

Alterar de:
```
rawScore = 10 + contactScore + engagementScore + paymentScore + profileScore + delayScore
```
Para:
```
rawScore = contactScore + engagementScore + paymentScore + profileScore + delayScore
```

### 3. Redefinir Dimensão 2 (Engajamento) para valorizar sinais reais de propensão (linhas 137-145)

A lógica atual só usa `responseRatio` (respostas / outreach). Trocar por um modelo aditivo dentro da mesma dimensão (0 a +30, expandido de 25):

```
let engagementScore = 0;
// Respondeu no WhatsApp (+5 por mensagem, max +10)
engagementScore += Math.min(whatsappInbound * 5, 10);
// Contato efetivo por ligação/disposition (+5)
if (lastContactDays >= 0) engagementScore += 5;
// Formalizou intenção de negociação (+5)
if (agreementsCreated > 0) engagementScore += 5;
// Formalizou negociação (+5, acima do created)
if (agreementsSigned > 0) engagementScore += 5;
// Pagamento parcial/entrada (+5)
if (partialPayment) engagementScore += 5;
// Pagamento confirmado (+10)
if (paymentConfirmed) engagementScore += 10;
// Cap at 30
engagementScore = Math.min(engagementScore, 30);
```

Isso permite que um cliente que respondeu, negociou e pagou chegue a +30, enquanto um que só respondeu no WhatsApp fica em +10.

### 4. Ajustar Dimensão 3 (Histórico de Pagamento) para penalizar mais quebra (linhas 147-155)

Manter estrutura, mas refinar:
- `paymentConfirmed && agreementsCancelled === 0` → +25 (mantém)
- `partialPayment` → +15 (sobe de 10, valoriza entrada/parcial)
- `paymentConfirmed && agreementsCancelled > 0` → +5 (pagou mas quebrou antes)
- `agreementsCancelled > 0 && !paymentConfirmed` → -20 (mantém)
- `agreementsCreated > 0 && agreementsSigned === 0 && !paymentConfirmed` → -5 (criou mas nunca fechou)

### 5. Ajustar score_reason para refletir novos sinais (linhas 214-222)

Adicionar razões:
- `agreementsCreated > 0 && agreementsSigned === 0` → "Acordo criado sem formalização"
- `whatsappInbound > 0` → "Respondeu no WhatsApp"
- `partialPayment` → "Pagamento parcial realizado"

### 6. Nenhuma outra alteração

- Dimensão 1 (Contato), Dimensão 4 (Perfil), Dimensão 5 (Atraso) — preservadas intactas
- Faixas 75/50 — preservadas
- PropensityBadge — intacto
- Banco, layout, telas — intactos

## Simulação de cenários

```text
Cenário                              | Score esperado
─────────────────────────────────────|──────────────
Sem eventos                          | 0
Só outbound sem resposta, 60d atraso | ~0-5
Respondeu WhatsApp, contato recente  | ~45
Respondeu + acordo criado            | ~55
Respondeu + acordo assinado          | ~65
Acordo assinado + pagamento parcial  | ~80
Acordo assinado + pago + perfil bom  | ~95-100
Quebrou acordo, sem resposta         | ~-15 → 0
```

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/calculate-propensity/index.ts` | Score 0 sem histórico, remover base +10, engajamento aditivo com sinais reais, pagamento refinado, reasons atualizadas |

## O que NÃO muda
- Nenhuma nova dimensão criada
- Nenhum score financeiro separado
- Banco, tabelas, migrações — intactos
- Layout, telas, componentes — intactos
- PropensityBadge thresholds (75/50) — intactos
- Contact Center, chat, atendimento — intactos

