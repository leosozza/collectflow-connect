

# Plano: Geração automática de boletos ao formalizar acordo + geração manual para todos os perfis

## Problemas identificados

1. **Boletos só são gerados quando `formaPagto === "BOLETO"` e o acordo NÃO é fora do padrão** (linha 395 do AgreementCalculator). Se o acordo vai para `pending_approval` (fora do padrão), boletos nunca são gerados — nem na criação, nem na aprovação posterior.

2. **Na aprovação (`approveAgreement` em agreementService.ts)**, apenas o status muda para `approved` — nenhuma lógica de geração de boletos é executada.

3. **A geração manual (`AgreementInstallments.tsx`)** já funciona para qualquer perfil que tenha acesso à tela do cliente, então esse ponto parece OK. O problema é que depende do operador lembrar de clicar "Gerar".

## Correções

### 1. Gerar boletos automaticamente via Edge Function após criação/aprovação

Mover a lógica de geração de boletos para uma **Edge Function** (`generate-agreement-boletos`) que:
- Recebe `agreement_id`
- Busca o acordo, parcelas simuladas (calcula com base em `new_installments`, `new_installment_value`, `first_due_date`, `entrada_value`, `entrada_date`, `custom_installment_values`)
- Busca dados cadastrais do cliente via `client_profiles`
- Chama a Negociarie para gerar os boletos
- Se faltar dados cadastrais, marca `boleto_pendente = true` sem bloquear

### 2. Chamar a Edge Function nos dois pontos de formalização

**a) AgreementCalculator.tsx (criação direta, sem aprovação):**
- Após `createAgreement`, chamar `supabase.functions.invoke("generate-agreement-boletos", { body: { agreement_id } })`
- Remover a condição `formaPagto === "BOLETO"` — boletos devem ser gerados sempre (a forma de pagamento é configuração do credor, não do operador)
- Manter o tratamento de erros/toast

**b) agreementService.ts (`approveAgreement`):**
- Após aprovar, chamar `supabase.functions.invoke("generate-agreement-boletos", { body: { agreement_id } })`
- Isso cobre o fluxo de acordos fora do padrão que passam por liberação

### 3. Manter a geração manual como está

A geração manual em `AgreementInstallments.tsx` já funciona sem restrição de perfil — não precisa de alteração. Serve como fallback quando `boleto_pendente = true`.

## Alternativa mais simples (sem Edge Function)

Se preferir evitar a criação de uma nova Edge Function, podemos:

- **No `approveAgreement`**: após aprovar, chamar `negociarie-proxy` com action `generate_boletos` passando os dados do acordo
- **No `AgreementCalculator`**: remover a condição `formaPagto === "BOLETO"` e a condição `!outOfStandard.isOut` — gerar boletos sempre que o acordo é criado com status direto (não `pending_approval`)

Isso é mais simples mas mantém a lógica no frontend.

## Resumo de alterações

| Arquivo | Alteração |
|---|---|
| `supabase/functions/generate-agreement-boletos/index.ts` | Nova Edge Function que calcula parcelas e chama Negociarie |
| `src/components/client-detail/AgreementCalculator.tsx` | Substituir geração local por chamada à Edge Function; remover condição `formaPagto === "BOLETO"` |
| `src/services/agreementService.ts` | Em `approveAgreement`, chamar Edge Function para gerar boletos após aprovação |

