

## Redesign da Calculadora de Acordos

Baseado nos prints de referência, a calculadora será reestruturada em 3 seções:

### Layout novo

```text
┌─────────────────────────────────────────────────────────────┐
│ Cálculo                              COPIAR TÍTULOS  PARAMS │
├─────────────────────────────────────────────────────────────┤
│ Data Cálculo │ % Juros │ % Multa │ % Honorários │ % Desc. │ [Valor Atualizado] │
├─────────────────────────────────────────────────────────────┤
│ ☑ Título │ Parc │ Vencimento │ Atraso │ V.Orig │ V.Base │  │
│   Protesto │ Tx.Contrato │ Juros │ Multa │ Honorários │ Total │
│ (tabela de títulos com checkboxes)                          │
├──────────────────────────────┬──────────────────────────────┤
│ Data Entrada    Valor Entr.  │ Parcela │ Forma │ Venc │ Vlr │
│ Qtde Parcelas                │  01/03  │BOLETO │ ...  │ ... │
│ Forma Pagto     Intervalo    │  02/03  │BOLETO │ ...  │ ... │
│ Vencto 1ª Parcela            │         │       │      │     │
│        [SIMULAR]             │         Total:  R$ X.XXX,XX  │
├──────────────────────────────┴──────────────────────────────┤
│ [GRAVAR ACORDO] [LIBERAÇÕES] [MAIS OPÇÕES]                  │
└─────────────────────────────────────────────────────────────┘
```

### Mudanças no `AgreementCalculator.tsx`

1. **Barra de parâmetros** no topo: Data de Cálculo (hoje), % Juros, % Multa, % Honorários, % Desconto Cap. — editáveis, pré-preenchidos com regras do credor. "Valor Atualizado" exibido em destaque verde à direita.

2. **Tabela de títulos expandida**: Adicionar colunas calculadas por título (Atraso em dias, Valor Base, Juros, Multa, Honorários, Total por linha). Cada linha recalcula ao alterar parâmetros.

3. **Seção inferior em 2 colunas**:
   - **Esquerda**: Formulário de acordo (Data Entrada, Valor Entrada, Qtde Parcelas, Forma de Pagamento [select: BOLETO/PIX/CARTÃO], Intervalo [Mensal dia fixo], Vencto 1ª Parcela, botão SIMULAR)
   - **Direita**: Tabela de simulação (Parcela, Forma Pagto, Vencimento, Valor) — só aparece após clicar SIMULAR. Total verde no rodapé.

4. **Barra de ações inferior**: GRAVAR ACORDO (principal), botão de liberação (se fora do padrão)

5. **Estado "simulated"**: boolean que controla exibição da tabela de parcelas à direita. SIMULAR gera as parcelas virtuais e exibe. GRAVAR ACORDO só fica habilitado após simular.

### Arquivo
- `src/components/client-detail/AgreementCalculator.tsx` — reescrita completa do layout

