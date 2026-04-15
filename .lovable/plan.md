

# Remover scroll principal do modal e organizar layout

## Problema
O `DialogContent` do modal "Formalizar Acordo" tem `overflow-y-auto` no container inteiro, causando scroll no modal todo. O scroll deve existir **apenas** nas parcelas.

## Solução

### 1. `src/pages/ClientDetailPage.tsx` (linha 484)
Trocar:
```
max-h-[90vh] overflow-y-auto
```
Por:
```
max-h-[90vh] overflow-hidden flex flex-col
```

### 2. `src/pages/AtendimentoPage.tsx` (linha 722)
Mesma alteração — remover `overflow-y-auto`, adicionar `overflow-hidden flex flex-col`.

### 3. `src/components/client-detail/AgreementCalculator.tsx`
- Envolver o conteúdo retornado pelo componente em um `div` com `flex flex-col overflow-hidden flex-1 min-h-0 gap-3`
- A Section 1 (dados do cliente) e Section 2 (parcelas com collapse) ficam com `flex-shrink-0` — ocupam só o espaço necessário
- A Section 3 (grid Condições + Simulação) fica com `flex-1 min-h-0 overflow-y-auto` apenas se necessário, mas como o scroll das parcelas já limita a 300px, o conteúdo todo caberá na tela sem scroll externo

Isso garante que o modal ocupe no máximo 90vh, sem scroll no container principal, e apenas as parcelas tenham rolagem interna.

