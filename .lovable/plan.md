## Objetivo
1. Ao fechar o widget RIVO Suporte, resetar o chat para que ao reabrir mostre novamente a tela inicial com os botões "Suporte" e "Financeiro".
2. Refinar o escopo da categoria **Financeiro** para tratar apenas assuntos tenant ↔ RIVO (mensalidade, comprovante, RIVO Coin, faturas RIVO), redirecionando para **Suporte** dúvidas operacionais (clientes do tenant que pagaram/não pagaram, baixas não realizadas).

## 1. Reset ao fechar (`src/components/support/SupportFloatingButton.tsx`)
- No handler de fechar widget, limpar estado: `category = null`, `messages = []`, remover chaves correspondentes do `localStorage`.
- Garantir que ao reabrir, o empty state volta com os dois botões grandes.
- Não afeta tickets humanos já criados em `support_tickets`.

## 2. Escopo Financeiro (`supabase/functions/support-ai-chat/index.ts`)
Atualizar `categoryHint` para `financeiro`:

**Trata:** pagamento do tenant para RIVO, envio de comprovante para liberação temporária, faturas/cobranças RIVO, pacotes de RIVO Coin, assuntos financeiros tenant ↔ RIVO.

**Não trata (redirecionar para Suporte):** clientes do tenant que pagaram/não pagaram, baixas não realizadas, conciliação de devedores, operação de cobrança em geral.

Quando o usuário em Financeiro perguntar algo operacional, a IA orienta educadamente a fechar e abrir em **Suporte**.

`categoryHint` de `suporte` permanece amplo (operação, módulos, integrações, baixas, conciliação de devedores, uso da plataforma).

## 3. Validação
- Abrir → escolher categoria → trocar mensagens → fechar → reabrir mostra tela inicial.
- Em Financeiro: "como envio comprovante da mensalidade RIVO" → responde. "Meu cliente não pagou a fatura" → orienta usar Suporte.

## Fora de escopo
- UI dos botões (já ajustada).
- Tickets humanos já abertos.
- Roteamento automático.
