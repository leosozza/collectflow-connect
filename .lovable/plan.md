## Objetivo

Padronizar todos os embaralhamentos de `whatsappCampaignService.ts` para usar **Fisher-Yates** (mesmo algoritmo já usado em `createRecipients`), eliminando o `sort(() => Math.random() - 0.5)` que é estatisticamente enviesado.

## Por que

- `Array.sort` com comparador aleatório não produz uma permutação uniforme — algumas ordens são bem mais prováveis que outras.
- Para Anti-Ban isso não é crítico, mas como já usamos Fisher-Yates corretamente em um ponto, faz sentido manter o mesmo algoritmo em todos os lugares (consistência + previsibilidade estatística).

## Mudança

Em `src/services/whatsappCampaignService.ts`:

1. Adicionar helper privado `shuffleFisherYates<T>(arr: T[]): T[]` no topo do arquivo (logo abaixo dos imports).
2. Substituir os 3 usos de `[...arr].sort(() => Math.random() - 0.5)`:
   - `distributeRoundRobin` (linha 168) — shuffle dos recipients
   - `distributeWeighted` linha 220 — shuffle inicial dos recipients
   - `distributeWeighted` linha 230 — re-shuffle final do resultado
3. Refatorar `createRecipients` (linhas 477-481) para também usar o helper, removendo o loop inline.

## O que NÃO muda

- Nenhuma API pública do service muda (assinaturas, retornos, ordem dos campos).
- Nenhuma alteração em `WhatsAppBulkDialog.tsx`, edge functions ou banco.
- Comportamento observável idêntico — só a qualidade estatística do embaralhamento melhora.

## Risco

Praticamente zero — é refactor puro, mesma semântica.
