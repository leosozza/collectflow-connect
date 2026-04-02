

# Plano: Corrigir formalização de acordos — dados não encontrados + falso "pago"

## Diagnóstico da cliente Thais dos Santos Pereira

**Dados no banco** (CPF 35535744883, 12 registros):
- 7 registros com `status=pago` (títulos originais já quitados)
- 5 registros com `status=em_acordo` (vinculados ao acordo pendente)
- **Email vazio em TODOS os 12 registros**
- Endereço, telefone, CEP, cidade, UF — todos preenchidos

### Problema 1: "Não encontrou informações da cliente"

O campo **email** está vazio. Quando o operador tenta formalizar o acordo com boleto, o sistema abre o diálogo de "campos obrigatórios ausentes" pedindo o email. Isso funciona corretamente, mas dois problemas tornam a experiência confusa:

**a)** O diálogo não mostra os campos que JÁ foram encontrados — parece que o sistema "não encontrou nada", quando na verdade só falta o email.

**b)** Se o operador clica "Pular (sem boleto)", o acordo é criado sem boleto, e em seguida o bug de pagamento (Problema 2) marca o acordo como pago.

### Problema 2: Acordo marcado como "pago" sem pagamento real

Já diagnosticado na conversa anterior — `AgreementInstallments` soma `valor_pago` de TODOS os registros do CPF (incluindo os 7 títulos originais pagos = R$ 722,50), superando o valor do acordo (R$ 400,01), marcando falsamente como pago.

## Correções

### 1. `src/components/client-detail/AgreementCalculator.tsx`

**Melhorar diálogo de campos faltantes:**
- Mostrar os campos já encontrados (preenchidos) acima dos campos faltantes, para o operador ver que o sistema encontrou os dados e só precisa complementar
- Alterar o texto do diálogo de "Preencha os dados do devedor" para "Quase lá! Apenas o campo abaixo precisa ser preenchido para gerar o boleto."
- Manter funcionalidade idêntica

### 2. `src/components/client-detail/AgreementInstallments.tsx`

**Corrigir fonte de pagamento do acordo:**
- Parar de somar `clients.valor_pago` genérico como proxy de pagamento do acordo
- Buscar pagamentos reais vinculados ao acordo via `client_events` com `event_type = 'payment_confirmed'` e `metadata->>'agreement_id'` correspondente
- Fallback para `manual_payments` se existir tabela
- Resultado: apenas pagamentos REAIS do acordo contam para marcar parcelas como pagas

### 3. `supabase/functions/auto-expire-agreements/index.ts`

**Mesma correção de fonte de pagamento:**
- Substituir query de `clients.valor_pago` por busca em `client_events` com `event_type = 'payment_confirmed'` filtrado por `agreement_id`
- Garantir que acordos não sejam marcados como pagos por pagamentos de títulos originais

### 4. `src/components/client-detail/AgreementCalculator.tsx` (calculadora)

**Mensagem quando todos os títulos estão em acordo:**
- Quando `pendentes.length === 0` e `hasActiveAgreement === true`, exibir mensagem clara: "Todos os títulos deste credor estão vinculados ao acordo vigente. Cancele o acordo existente para renegociar."
- Evitar que o operador fique confuso com calculadora vazia

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/AgreementCalculator.tsx` | Diálogo mais claro + mensagem quando sem títulos disponíveis |
| `src/components/client-detail/AgreementInstallments.tsx` | Corrigir fonte de pagamento — usar `client_events` em vez de `clients.valor_pago` |
| `supabase/functions/auto-expire-agreements/index.ts` | Mesma correção de fonte de pagamento |

Nenhuma alteração em banco ou tabelas. O fluxo de formalização permanece idêntico.

