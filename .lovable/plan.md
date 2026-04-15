
# Botão "Reativar Acordo" na aba Acordos

## Resumo
Adicionar um botão "Reativar Acordo" nos acordos com status `cancelled` (Quebra de Acordo), que abre o modal "Formalizar Acordo" com todos os campos pré-preenchidos do acordo quebrado (descontos, parcelas, meios de pagamento, datas). O botão só aparece se o cliente não tem outro acordo vigente.

## Alterações

### 1. `src/pages/ClientDetailPage.tsx`

**Novo estado para reativação:**
- Adicionar estado `reactivateAgreement` para armazenar o acordo a ser reativado
- Quando o botão "Reativar Acordo" é clicado, salvar o acordo no estado e abrir o modal de Formalizar Acordo (`setShowCalculator(true)`)

**Botão na aba Acordos:**
- Nos acordos com `status === "cancelled"`, exibir botão "Reativar Acordo" (ícone `RotateCcw`) ao lado do badge de status
- O botão só aparece se `!hasActiveAgreement` (mesmo check usado no AgreementCalculator)

**Passar dados para AgreementCalculator:**
- Adicionar prop `reactivateFrom` ao `AgreementCalculator` contendo os dados do acordo quebrado
- Limpar o estado ao fechar o modal

### 2. `src/components/client-detail/AgreementCalculator.tsx`

**Nova prop opcional:**
```typescript
interface AgreementCalculatorProps {
  // ... existing props
  reactivateFrom?: Agreement | null;
}
```

**Pré-preenchimento no `useEffect`:**
Quando `reactivateFrom` é fornecido, preencher automaticamente:
- `descontoPercent` ← `reactivateFrom.discount_percent`
- `numParcelas` ← `reactivateFrom.new_installments`
- `firstDueDate` ← data de hoje (novo acordo, nova data)
- `notes` ← `"Reativação do acordo de " + data_original`
- `entradas` ← reconstruir a partir de `custom_installment_values` (entradas com método)
- `formaPagto` ← extrair do `custom_installment_values` (campo `entrada_method` ou default BOLETO)

Os valores de juros, multa e honorários continuarão sendo carregados pelas regras do credor (já existente). O desconto será sobrescrito pelo valor do acordo original.

### 3. `src/pages/AtendimentoPage.tsx`
Mesma lógica — passar `reactivateFrom` ao AgreementCalculator se a tela de atendimento também permite formalizar acordos.

## Regra de negócio
- Só mostrar "Reativar" em acordos `cancelled`
- Só permitir se não houver acordo vigente (`pending`, `approved`, `pending_approval`) para o mesmo CPF/credor
- O operador ainda precisa clicar "Simular" e "Gravar" — a reativação apenas pré-preenche os campos

## Resultado
O operador clica em "Reativar Acordo" → modal abre com todos os campos do acordo anterior preenchidos → ajusta se necessário → simula → grava. Reduz o retrabalho de 5+ minutos para segundos.
