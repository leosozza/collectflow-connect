

# Acordo apenas com Entrada (parcelas começando em zero)

## Problema

1. O campo "Parcelas" inicia em `1` — operador não consegue criar acordo só com entrada(s)
2. Ao deixar parcelas em `0`, o `onBlur` força de volta para `1`
3. Quando parcelas = 0, a simulação ainda tenta gerar parcelas e exige `firstDueDate`
4. Ao submeter, `first_due_date` é obrigatório mesmo quando não há parcelas — apenas entradas

## Alterações em `src/components/client-detail/AgreementCalculator.tsx`

### A. Parcelas iniciam em 0
- **Linha 78**: `numParcelas` de `1` para `0`
- **Linha 694**: remover o `onBlur` que força mínimo 1 — permitir `0`

### B. Simulação funciona com 0 parcelas
- **Linha 273-318** (`handleSimulate`): quando `numParcelas === 0`, não exigir `firstDueDate` — apenas validar que há pelo menos uma entrada com data e valor. Gerar simulação apenas com as entradas.

### C. Parcelas UI condicional
- **Linhas 697-723**: Esconder os campos "Pagto Parcelas", "Intervalo" e "Vencto 1ª Parc." quando `numParcelas === 0`, pois não há parcelas a configurar — apenas entradas.

### D. Submit com 0 parcelas
- **Linha 480**: `new_installments` pode ser `0`
- **Linha 482**: `first_due_date` usa a data da primeira entrada como fallback quando `firstDueDate` está vazio e parcelas = 0
- **Linha 481**: `new_installment_value` = `0` quando parcelas = 0

### E. Edge Function já suporta
A função `generate-agreement-boletos` já itera `entradaKeys` separadamente das parcelas (linha 101-112 e 114-130). Com `new_installments = 0`, o loop de parcelas simplesmente não executa. As entradas com método BOLETO serão geradas normalmente. **Nenhuma alteração necessária na Edge Function.**

## Arquivo alterado
- `src/components/client-detail/AgreementCalculator.tsx`

