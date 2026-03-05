

## Plano: Corrigir perfil do devedor com múltiplos contratos e cálculos financeiros

### Problemas identificados

1. **Modelo e Cod.Contrato**: O header mostra apenas `client.model_name` e `client.cod_contrato` do primeiro registro. Quando há múltiplos contratos (mesmo CPF, credores/modelos diferentes), precisa mostrar todos os valores distintos.

2. **Cálculos financeiros incorretos no header** (seção "Mais informações"):
   - **Saldo Devedor**: mostra `client.valor_saldo` de apenas 1 registro. Deveria somar `valor_saldo` de todos os registros pendentes.
   - **Total Pago**: soma `valor_pago` de todos — OK.
   - **Valor Atualizado**: mostra `client.valor_atualizado` de 1 registro. Deveria somar de todos.
   - **Em Aberto**: usa fallback correto, mas precisa considerar `valor_atualizado` quando disponível.

3. **Valor Atualizado não é calculado**: O campo `valor_atualizado` no banco está sempre 0. Deveria ser calculado com base nos juros e multa do credor vinculado, aplicados sobre o saldo em atraso.

4. **AgreementCalculator `originalTotal`**: usa `valor_parcela` sem fallback para `valor_saldo`.

### Correções em `src/components/client-detail/ClientDetailHeader.tsx`

1. **Múltiplos contratos**: Extrair valores distintos de `model_name` e `cod_contrato` de `clients[]` e exibi-los separados por " / "
   ```
   const modelNames = [...new Set(clients.map(c => c.model_name).filter(Boolean))].join(" / ");
   const codContratos = [...new Set(clients.map(c => c.cod_contrato).filter(Boolean))].join(" / ");
   ```

2. **Saldo Devedor agregado**: Somar `valor_saldo` de todos os registros pendentes
   ```
   const totalSaldo = clients.filter(c => c.status === "pendente")
     .reduce((sum, c) => sum + (Number(c.valor_saldo) || 0), 0);
   ```

3. **Valor Atualizado agregado**: Somar `valor_atualizado` de todos os pendentes. Se for 0, calcular dinamicamente usando juros/multa do credor:
   - Buscar regras do credor (`juros_mes`, `multa`)
   - Para cada parcela pendente vencida: `valorBase + (valorBase * multa/100) + (valorBase * juros_mes/100 * mesesAtraso)`
   - Parcelas não vencidas mantêm o valor original

4. **Em Aberto**: Usar `valor_atualizado` calculado como base quando disponível

### Correções em `src/components/client-detail/AgreementCalculator.tsx`

5. **`originalTotal`**: Adicionar fallback `valor_saldo`
   ```
   .reduce((sum, c) => sum + (Number(c.valor_parcela) || Number(c.valor_saldo) || 0), 0);
   ```

### Arquivos alterados
- `src/components/client-detail/ClientDetailHeader.tsx`
- `src/components/client-detail/AgreementCalculator.tsx`

