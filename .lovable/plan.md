

## Diagnóstico: Valores R$ 0,00 em todos os títulos

### Causa raiz
Todos os 1.000 registros no banco de dados têm `valor_parcela = 0.00`, porém `valor_saldo` contém os valores corretos (ex: 100, 680, 4200...). Isso ocorre porque a API MaxSystem retorna `Value = 0` e `NetValue = valor real`. Durante a importação, `Value` é mapeado para `valor_parcela` (que fica 0) e `NetValue` é mapeado para `valor_saldo` (que fica correto).

O problema está em três camadas: a importação não usa o campo correto como fallback, e a exibição depende exclusivamente de `valor_parcela`.

### Correções

**1. `src/pages/MaxListPage.tsx` — Importação**
- Na função `buildRecordFromMapping` (linha ~550), alterar a lógica de `valor_parcela` para usar `valor_saldo` como fallback quando `valor_parcela` é 0:
  ```
  valor_parcela: record.valor_parcela || record.valor_saldo || 0
  ```

**2. `src/pages/ClientDetailPage.tsx` — Exibição dos títulos**
- Na tabela de títulos (linhas ~230-237), usar `valor_saldo` como fallback:
  ```
  const valorEfetivo = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
  ```
- Aplicar esse valor efetivo em: coluna Valor, cálculo de Saldo Devedor, e `totalAberto`

**3. `src/components/carteira/CarteiraTable.tsx` — Tabela da Carteira**
- No agrupamento (`grouped`), usar o mesmo fallback ao calcular `valorTotal`

**4. `src/pages/CarteiraPage.tsx` — Carteira principal**
- Verificar se o cálculo de valor total na tabela principal também usa o fallback

**5. Dados existentes (opcional)**
- Os dados já importados continuarão mostrando valores corretos via fallback para `valor_saldo`. Novas importações já populam `valor_parcela` corretamente.

### Resumo
A alteração principal é usar `Number(c.valor_parcela) || Number(c.valor_saldo) || 0` em todos os pontos de exibição de valor, e na importação para garantir que futuras importações preencham `valor_parcela` corretamente.

