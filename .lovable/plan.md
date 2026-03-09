

## Plano: Adicionar Índice de Correção Monetária na aba Negociação do Credor

### O que será feito

1. **Nova coluna no banco**: Adicionar `indice_correcao_monetaria` (text, nullable) na tabela `credores`
2. **UI na aba Negociação**: Adicionar um Switch "Ativar Índice de Correção Monetária" + Select com os índices (nomes completos, não abreviados) logo após o campo "Prazo para pagamento do acordo"
3. **Persistência**: Incluir o novo campo no `handleSaveNegociacao` e no `handleSave` geral

### Índices disponíveis (nomes completos)
- Taxa de Juros - São Paulo (TJ/SP)
- Taxa de Juros - Minas Gerais (TJ/MG)
- Taxa de Juros - Rio de Janeiro (Lei 11.690/2009)
- Taxa de Juros - Paraná (TJ/PR)
- Índice Nacional de Preços ao Consumidor (INPC)
- Índice Geral de Preços do Mercado (IGPM)
- Índice Nacional de Custo da Construção (INCC)
- Índice de Preços ao Consumidor Amplo (IPCA)
- Unidade Fiscal de Referência (UFIR)
- Sistema Especial de Liquidação e Custódia (SELIC)
- Índice Geral de Preços - Disponibilidade Interna (IGP-DI)
- Taxa Básica Financeira (TBF)
- Taxa Referencial (TR)

### Arquivos alterados
- **Migração SQL**: adicionar coluna `indice_correcao_monetaria`
- **`src/components/cadastros/CredorForm.tsx`**: Switch + Select na seção Negociação, salvar no `handleSaveNegociacao`

---

### Explicação das regras e lógicas de Negociação

A aba Negociação do Credor define as regras que controlam como acordos podem ser firmados:

| Campo | Função |
|-------|--------|
| **Parcelas Mínimas/Máximas** | Limita o range de parcelamento permitido (ex: 1 a 12x) |
| **Entrada Mínima** | Valor ou percentual mínimo exigido como primeira parcela. Pode ser fixo (R$) ou percentual (%) |
| **Desconto Máximo (%)** | Teto de desconto que o operador pode conceder sem precisar de aprovação do gestor |
| **Juros ao Mês (%)** | Taxa de juros moratórios aplicada mensalmente sobre parcelas vencidas. Usado no cálculo do "Valor Atualizado" no perfil do devedor |
| **Multa (%)** | Percentual de multa aplicado uma vez sobre parcelas vencidas. Também usado no cálculo do "Valor Atualizado" |
| **Prazo para pagamento (dias)** | Prazo máximo em dias para o devedor efetuar o pagamento após a formalização do acordo |
| **Índice de Correção Monetária** *(novo)* | Índice oficial usado para atualizar monetariamente o valor da dívida (ex: IPCA, SELIC, IGPM) |

**Fluxo de negociação:**
1. Operador abre o painel de negociação no perfil do devedor
2. Pode usar templates pré-definidos ou simular manualmente desconto/parcelas
3. Sistema compara os valores com as regras do credor
4. Se dentro dos limites → "Gerar Acordo" (aprovação automática)
5. Se fora dos limites → "Solicitar Liberação" (requer aprovação do gestor)

**Cálculo do Valor Atualizado** (no perfil do devedor):
```
Para cada parcela vencida:
  valorBase = valor_parcela || valor_saldo
  mesesAtraso = diferença em meses entre hoje e data_vencimento
  valorAtualizado = valorBase + (valorBase × multa/100) + (valorBase × juros_mes/100 × mesesAtraso)
```

**Faixas de Desconto por Aging**: Permite configurar descontos automáticos escalonados por tempo de atraso (ex: 0-30 dias = 30% desconto, 31-60 dias = 20%).

**Grade de Honorários**: Define a comissão do escritório de cobrança por faixa de valor recuperado.

