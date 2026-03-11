

# Correção do Dialog "Editar Acordo"

## Diagnóstico

### Dados do Alexandre dos Santos
O acordo **ativo** (bb1bb333) está correto no banco: `entrada_value=351`, `new_installments=5`, `new_installment_value=189.8`. O acordo anterior (6x sem entrada) já foi cancelado. O problema é que o **dialog de edição não mostra a entrada** e o cálculo do valor da parcela não desconta a entrada.

### Problemas do Dialog Atual
1. **Não mostra entrada** — campos `entrada_value` e `entrada_date` não aparecem
2. **Cálculo errado** — `proposed / installments` deveria ser `(proposed - entrada) / installments`
3. **Falta contexto** — não mostra desconto %, status atual, data de criação
4. **Layout confuso** — campos misturados sem agrupamento lógico

## Plano

### Refatorar o edit dialog em `AcordosPage.tsx`

**Novo layout do dialog:**

```text
┌─────────────────────────────────────────┐
│ Editar Acordo            [Badge Status] │
├─────────────────────────────────────────┤
│ Cliente: Alexandre dos Santos           │
│ Credor: YBRASIL    Criado: 10/03/2026   │
├─────────────────────────────────────────┤
│ VALORES                                 │
│ Original: R$ 1.300   Desconto: 0%       │
│ Valor do Acordo: R$ [1.300,00]          │
├─────────────────────────────────────────┤
│ ENTRADA                                 │
│ Valor Entrada: R$ [351,00]              │
│ Data Entrada:  [10/03/2026]             │
├─────────────────────────────────────────┤
│ PARCELAMENTO                            │
│ Nº Parcelas: [5]                        │
│ Valor Parcela: R$ 189,80 (calculado)    │
│ 1º Vencimento: [10/04/2026]             │
├─────────────────────────────────────────┤
│ Observações: [________________]         │
│                                         │
│ [====== Salvar Alterações ======]       │
└─────────────────────────────────────────┘
```

**Mudanças no código:**

1. **editForm state** — adicionar `entrada_value` e `entrada_date`
2. **handleEditOpen** — carregar `(a as any).entrada_value` e `(a as any).entrada_date`
3. **Cálculo do valor parcela** — `(proposed - entrada) / installments`
4. **handleEditProposed** — recalcular parcela descontando entrada
5. **handleEditInstallments** — recalcular parcela descontando entrada
6. **Nova função handleEditEntrada** — ao mudar entrada, recalcular parcela
7. **Dialog layout** — seções visuais com separadores, badge de status, campos de entrada

### Arquivo a editar

| Arquivo | Ação |
|---|---|
| `src/pages/AcordosPage.tsx` | Refatorar edit dialog com entrada + layout melhorado |

