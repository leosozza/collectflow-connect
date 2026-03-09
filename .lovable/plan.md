

## Correções: Coluna Carteira + Indicadores Financeiros do Perfil

### 1. Remover coluna "Valor Total" da Carteira
**Arquivo:** `src/pages/CarteiraPage.tsx`
- Remover `<TableHead>Valor Total</TableHead>` (linha 741)
- Remover `<TableCell>` correspondente com `formatCurrency(...)` (linha 773)

### 2. Corrigir "Total Pago" no cabeçalho do perfil
**Arquivo:** `src/components/client-detail/ClientDetailHeader.tsx`

**Problema:** Linha 138 soma apenas `valor_pago` dos registros de clients. Não inclui pagamentos de acordos.

**Correção:** Somar `valor_pago` de todos os registros (não só pendentes) + somar `proposed_total` de acordos com status `approved` (pagos). Precisamos receber `agreements` como prop.

### 3. Corrigir "Saldo Devedor"
**Problema:** Linha 147-148 filtra apenas `pendente`/`vencido`, ignorando registros `em_acordo`.

**Correção:** Saldo devedor = soma de `valor_parcela` (ou `valor_saldo`) de TODOS os registros que não são `pago`. Isso inclui `pendente`, `vencido` e `em_acordo`.

### 4. Corrigir "Valor Atualizado"
**Problema:** Mesma filtragem errada (só `pendente`/`vencido`).

**Correção:** Calcular juros/multa sobre todos os registros não-pagos.

### 5. Corrigir "Em Aberto"
**Problema:** `totalAberto` calculado em `ClientDetailPage.tsx` (linha 119-121) soma apenas `pendente`/`vencido`.

**Correção:** Em Aberto = Saldo Devedor total - Total efetivamente pago (valor_pago de parcelas originais + pagamentos de acordos). Representra o que ainda falta pagar.

### Mudanças concretas

**`src/pages/CarteiraPage.tsx`:**
- Remover coluna "Valor Total" (header + cell)

**`src/pages/ClientDetailPage.tsx`:**
- Passar `agreements` como prop para `ClientDetailHeader`
- Recalcular `totalAberto` considerando todos os registros não-pagos menos pagamentos realizados

**`src/components/client-detail/ClientDetailHeader.tsx`:**
- Adicionar `agreements` na interface de props
- **Total Pago:** `sum(valor_pago)` de todos os clients + `sum(proposed_total)` dos acordos `approved`
- **Saldo Devedor:** `sum(valor_parcela)` de todos registros não-pagos (pendente + vencido + em_acordo)
- **Valor Atualizado:** Aplicar juros/multa sobre todos os registros não-pagos
- **Em Aberto:** Saldo total original - tudo que já foi pago (parcelas originais + acordos pagos)

