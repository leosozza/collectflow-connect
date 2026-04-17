

## Plano — Separar "Status do Acordo" e "Status da Parcela" na lista de Acordos

### Contexto
Hoje a coluna chamada **"Status"** mostra `agreement.status` (Vigente/Vencido/Quitado/etc.), o que confunde quando um acordo aparece em "Pagos" com badge "Vencido" — porque o badge é do **acordo inteiro**, não da parcela em foco.

### Mudanças

**1. Renomear coluna existente**
- `AgreementsList.tsx`: header `"Status"` → **`"Status do Acordo"`**.
- Mantém os mesmos labels já definidos: `Acordo Vigente`, `Vencido`, `Quitado` (após rename do `approved`), `Aguardando Liberação`, `Rejeitado`, `Cancelado`. Sem nomenclatura nova.

**2. Adicionar nova coluna `Status da Parcela`**
Posicionada **entre "Parcelas Pagas" e "Status do Acordo"**.

Reusa a classificação que já existe em `agreementInstallmentClassifier.ts` (`pago | vigente | vencido | pending_confirmation`) e o atributo `_installmentClass` que `AcordosPage` já calcula no useMemo. Mapeamento de labels (reaproveitando termos já em uso no sistema):

| `_installmentClass` | Badge label | Cor |
|---|---|---|
| `pago` | **Pago** | verde |
| `vigente` | **A Vencer** | azul |
| `vencido` | **Vencida** | âmbar |
| `pending_confirmation` | **Aguardando Confirmação** | roxo |
| (sem mês selecionado / `undefined`) | **—** | neutro |

Observação importante: o `_installmentClass` só é definido quando há **mês/ano selecionado** (modo "Todos os Meses" não classifica por parcela). Nesse caso, mostra `—` com tooltip "Selecione um mês para ver o status da parcela".

**3. Renomear `approved` → "Quitado"** (mudança trivial alinhada à conversa anterior) no `statusLabels` de:
- `AgreementsList.tsx`
- `PaymentConfirmationTab.tsx` (se aplicável)

### Resultado
- Cliente como **Kamilly** na aba "Pagos" com mês selecionado vai mostrar:
  - Parcelas Pagas: `1 / 4`
  - **Status da Parcela: Pago** (a do mês)
  - **Status do Acordo: Acordo Vigente** (ou Vencido, se houver atraso geral)
- Sem nomenclaturas novas: reaproveita `Pago`, `A Vencer`, `Vencida`, `Aguardando Confirmação`, `Acordo Vigente`, `Quitado` que já circulam no sistema.

### Arquivos
- `src/components/acordos/AgreementsList.tsx` — rename header + nova coluna + render do badge de parcela.
- `src/pages/AcordosPage.tsx` — garantir que `_installmentClass` é propagado (já está no objeto, só confirmar).

### Sem alterações em
Schema, RLS, classifier, services. Pura UI.

