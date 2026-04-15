

# Adaptar modal "Formalizar Acordo" a diferentes tamanhos de tela

## Problema
O modal usa alturas fixas (`max-h-[300px]` para parcelas, `max-h-[40vh]` para simulação) e o container externo usa `max-h-[90vh]` com `overflow-hidden`. Em monitores menores (720p, 768p), o conteúdo é cortado porque as seções fixas consomem mais espaço relativo e o `overflow-hidden` impede qualquer escape.

## Solução

### 1. `AgreementCalculator.tsx` — tornar alturas responsivas

**Parcelas (Section 2):**
- Trocar `max-h-[300px]` por `max-h-[25vh]` — adapta proporcionalmente ao monitor

**Simulação (Section 3 — CardContent):**
- Trocar `max-h-[40vh]` por `max-h-[30vh]`

**Grid Condições + Simulação (Section 3):**
- Adicionar `overflow-hidden` ao grid container para evitar que ele empurre o botão para fora
- O card "Condições do Acordo" recebe `overflow-y-auto max-h-[35vh]` no CardContent para monitores pequenos

**Container principal:**
- Manter `flex flex-col overflow-hidden flex-1 min-h-0` mas adicionar `overflow-y-auto` para que, em telas muito pequenas, o modal inteiro tenha fallback de scroll

### 2. `ClientDetailPage.tsx` e `AtendimentoPage.tsx` — DialogContent

- Trocar `max-h-[90vh] overflow-hidden` por `max-h-[90vh] overflow-y-auto` no DialogContent
- Isso garante que, se o conteúdo exceder 90vh em monitores pequenos, o operador consegue rolar ao invés de ver cortado

### Resultado
- Em monitores grandes (1080p+): layout idêntico ao atual, sem scroll externo
- Em monitores médios (768p-900p): parcelas e simulação diminuem proporcionalmente
- Em monitores pequenos: fallback de scroll no modal inteiro, nada fica cortado

