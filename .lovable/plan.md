

# Scroll lateral direita + Responsividade na tela Formalizar Acordo

## Problema atual

O scroll está dentro do card "Condições do Acordo" (`overflow-y-auto max-h-[35vh]` na linha 562), não no container principal. O usuário quer que o scroll seja no card inteiro (lateral direita do dialog), rolando todo o conteúdo de uma vez.

Além disso, o layout de 2 colunas (`md:grid-cols-2`) não se adapta bem em telas menores.

## Alterações

### 1. `src/components/client-detail/AgreementCalculator.tsx`

- **Linha 544**: manter `overflow-y-scroll` no container raiz — este é o scroll principal do dialog inteiro
- **Linha 556**: remover `overflow-hidden` do grid 2 colunas
- **Linha 558**: remover `overflow-hidden` do Card esquerdo
- **Linha 562**: remover `overflow-y-auto max-h-[35vh] flex-1 min-h-0` do CardContent — deixar o conteúdo fluir naturalmente, sem scroll interno
- Fazer o mesmo para qualquer outro card/seção à direita que tenha scroll interno próprio
- Resultado: um único scrollbar na lateral direita do dialog rolando tudo

**Responsividade:**
- Grid de 2 colunas (`md:grid-cols-2`) → trocar para `lg:grid-cols-2` para breakpoint mais alto
- Inputs internos com grids de 4 colunas → usar `grid-cols-2 sm:grid-cols-4` para mobile
- Botões e labels com tamanhos mínimos adequados

### 2. `src/pages/ClientDetailPage.tsx` (linha 521)
- Manter `overflow-hidden flex flex-col` no DialogContent (o scroll fica no filho AgreementCalculator)

### 3. `src/pages/AtendimentoPage.tsx` (linha 722)
- Mesma lógica — manter `overflow-hidden flex flex-col` no DialogContent

### Arquivos alterados
- `src/components/client-detail/AgreementCalculator.tsx` — remover scrolls internos dos cards, melhorar breakpoints responsivos

