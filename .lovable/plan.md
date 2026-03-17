

# Fix: Valor Saldo mostrando valor de registro único em vez do consolidado

## Problema

O campo "Valor Saldo" na expansão mostra `client.valor_saldo` = R$ 500,00 (do registro individual, parcela 1). Porém o header principal mostra "Em Aberto" = R$ 1.300,00 que é a soma de todas as parcelas pendentes do CPF.

O `client` passado ao `ClientHeader` é apenas **um registro** (a parcela selecionada). Os campos `valor_saldo` e `valor_atualizado` precisam ser **agregados** de todos os registros do CPF, assim como já é feito para `totalAberto` e `totalPago`.

Dados reais do CPF 00459137220 (Edinalva):
- Parcela 1: valor_saldo=500 (pago)
- Parcela 2: valor_saldo=118.20 (pendente)
- Parcela 3: valor_saldo=118.18 (pendente)
- Parcela 4: valor_saldo=118.18 (pendente)

## Solução

1. **`AtendimentoPage.tsx`**: Passar `clientRecords` como prop ao `ClientHeader`
2. **`ClientHeader.tsx`**: 
   - Aceitar `clientRecords` como prop
   - No `FIELD_RENDERERS`, calcular `valor_saldo` como soma de `valor_saldo` de todos os registros pendentes
   - Calcular `valor_atualizado` como soma de `valor_atualizado` de todos os registros pendentes
   - Campos como `phone`, `email`, `endereco`, etc. continuam vindo do `client` individual (são iguais entre parcelas)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/AtendimentoPage.tsx` | Passar `clientRecords` ao ClientHeader |
| `src/components/atendimento/ClientHeader.tsx` | Aceitar `clientRecords`, agregar valor_saldo e valor_atualizado |

