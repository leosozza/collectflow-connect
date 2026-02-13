
# Correcao da Experiencia Mobile: Reconhecimento Facial e Assinatura na Tela

## Problemas Identificados

1. **Reconhecimento Facial no mobile**: A tela de "Iniciar Captura" e a captura em si nao abrem em tela cheia real. Ficam dentro de um container com borda, sem ocupar a tela toda do dispositivo.

2. **Assinatura na Tela no mobile**: Quando o usuario gira o celular para paisagem, o layout inteiro gira junto e a area de assinatura fica cortada/inutilizavel. Nao ha tratamento de orientacao.

---

## Solucao

### 1. Fullscreen real no mobile (Facial e Draw)

No `SignsPage.tsx`, quando `isMobile` e `playgroundStep === "assinatura"` com tipo `facial` ou `draw`, renderizar o conteudo como um **overlay fixo** (`fixed inset-0 z-50`) cobrindo toda a viewport, em vez de dentro do container com borda.

Isso garante que:
- A camera do facial ocupe 100% da tela
- A area de assinatura ocupe 100% da tela
- O header e badges do playground fiquem escondidos durante a assinatura

### 2. Orientacao fixa para Assinatura na Tela (Draw)

No componente `SignatureDraw.tsx`, quando `fullscreen=true`:
- Usar a Screen Orientation API (`screen.orientation.lock('landscape')`) para tentar travar em paisagem automaticamente
- Como fallback (iOS Safari nao suporta lock), aplicar uma **rotacao CSS de 90 graus** no container da assinatura para simular paisagem
- O canvas deve se adaptar ao tamanho rotacionado (largura = altura da viewport, altura = largura da viewport)
- Adicionar um botao de fechar/voltar visivel

### 3. Ajustes no SignatureFacial.tsx

- No modo `fullscreen`, garantir que o container use `fixed inset-0` em vez de `absolute inset-0` quando renderizado fora do frame do iPhone (mobile real)
- O video deve ter `playsInline` (ja tem) e `object-cover` para preencher toda a tela

---

## Detalhes Tecnicos

### Arquivo: `src/pages/SignsPage.tsx`

Mudancas no bloco mobile do playground:
- Quando `isMobile && isFullscreenMode`, renderizar um portal/overlay fixo com `fixed inset-0 z-50 bg-background` fora do container normal
- Incluir botao de "Voltar" no overlay para sair do modo fullscreen
- O container normal com borda so aparece quando NAO esta em fullscreen

### Arquivo: `src/components/portal/signatures/SignatureDraw.tsx`

Mudancas no modo fullscreen:
- Tentar `screen.orientation.lock('landscape')` no mount (com try/catch para browsers que nao suportam)
- Fallback CSS: container com `transform: rotate(90deg)` e dimensoes invertidas (`width: 100vh, height: 100vw`)
- Canvas redimensionado para aproveitar o espaco landscape
- `screen.orientation.unlock()` no unmount
- Adicionar `touch-action: none` para evitar scroll acidental no iOS

### Arquivo: `src/components/portal/signatures/SignatureFacial.tsx`

Mudancas no modo fullscreen:
- Trocar `absolute inset-0` por `fixed inset-0 z-50` nos estados idle, capturing, done e error quando em fullscreen real (mobile)
- Garantir que a camera preencha toda a tela sem barras

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/SignsPage.tsx` | Overlay fixo no mobile para facial/draw em fullscreen |
| `src/components/portal/signatures/SignatureDraw.tsx` | Orientacao landscape forcada + canvas adaptativo |
| `src/components/portal/signatures/SignatureFacial.tsx` | Fixed positioning no fullscreen mobile |
