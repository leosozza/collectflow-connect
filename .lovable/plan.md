

## Análise do Acordo "Entrada + Parcelas" — Bugs e Melhorias

### Bugs Encontrados

**Bug 1: Acordo não armazena o valor da entrada**
A tabela `agreements` não possui coluna para `entrada_value`. Quando o modelo "Entrada 30% + 5 Parcelas" é usado, o sistema salva `new_installments = 6` (1 entrada + 5 parcelas) e `new_installment_value` = valor das parcelas regulares (sem a entrada). O valor da entrada se perde.

**Bug 2: Exibição incorreta na /acordos**
A coluna "Parcelas" mostra `6x R$ [valor_parcela]`, mas a 1ª parcela (entrada) tem valor diferente das demais. A matemática não fecha: `6 × valor_parcela ≠ proposed_total`.

**Bug 3: AgreementInstallments mostra todas parcelas com mesmo valor**
Na tela de detalhe do cliente, as 6 parcelas virtuais são geradas com o mesmo valor, quando a 1ª deveria ser a entrada (30% do proposto) e as demais o valor restante dividido.

### Plano de Correção

#### 1. Migração: Adicionar colunas `entrada_value` e `entrada_date` na tabela `agreements`
```sql
ALTER TABLE agreements ADD COLUMN entrada_value numeric DEFAULT 0;
ALTER TABLE agreements ADD COLUMN entrada_date date;
```

#### 2. `AgreementCalculator.tsx` — Salvar entrada no acordo
- Incluir `entrada_value` e `entrada_date` no payload enviado ao `createAgreement`
- Manter `new_installments` como o número de parcelas **sem** a entrada (5, não 6)

#### 3. `agreementService.ts` — Aceitar novos campos
- Adicionar `entrada_value` e `entrada_date` ao `AgreementFormData`

#### 4. `AgreementsList.tsx` — Exibição correta na /acordos
- Se `entrada_value > 0`: mostrar "Entrada R$ X + 5x R$ Y"
- Se não: manter "5x R$ Y"

#### 5. `AgreementInstallments.tsx` — Parcelas virtuais corretas
- Se acordo tem `entrada_value > 0`: gerar parcela #1 com valor da entrada e data da entrada, depois as demais com valor regular

### Arquivos a modificar
- **Migração SQL** — nova coluna `entrada_value`, `entrada_date`
- `src/services/agreementService.ts` — novos campos no tipo e insert
- `src/components/client-detail/AgreementCalculator.tsx` — enviar entrada no payload, `new_installments` = parcelas sem entrada
- `src/components/acordos/AgreementsList.tsx` — exibição "Entrada + Parcelas"
- `src/components/client-detail/AgreementInstallments.tsx` — parcela #1 com valor de entrada

