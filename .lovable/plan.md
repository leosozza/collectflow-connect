## Trocar ícone do botão "Cancelar Parcela"

**Status atual:** O cancelamento de parcela já está 100% funcional e visível para operadores em `AgreementInstallments.tsx` (botão na linha de cada parcela ativa). Ele abre diálogo pedindo motivo, cancela o boleto na Negociarie automaticamente e recalcula o `proposed_total`.

**Mudança:** trocar o ícone `Trash2` (lixeira — sugere exclusão) pelo `Ban` (⊘ — círculo com risco diagonal, símbolo universal de cancelado).

### Arquivo

`src/components/client-detail/AgreementInstallments.tsx`

1. Adicionar `Ban` ao import do `lucide-react` (linha 35).
2. Linha 1336: trocar `<Trash2 className="w-4 h-4" />` por `<Ban className="w-4 h-4" />`.

Nada mais muda — cor destrutiva, tooltip "Cancelar Parcela", lógica e diálogo permanecem iguais. O ícone do botão de Reativar (linha ~1355, `RotateCcw`) também não muda.