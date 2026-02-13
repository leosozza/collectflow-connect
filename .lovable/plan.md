

# Facial Fullscreen no Celular + Camera Fix + Mobile Responsivo

## Problemas Identificados

### 1. Camera nao captura (BUG)
O `startCamera` tenta definir `videoRef.current.srcObject` enquanto o video ainda nao existe no DOM. O fluxo atual:
- Estado e `idle` -> video NAO esta renderizado
- `startCamera` obtem o stream e tenta `videoRef.current.srcObject = mediaStream` -> **videoRef.current e NULL**
- So depois muda para `capturing` -> video aparece, mas sem stream

**Correcao:** Usar um `useEffect` que observa o `stream` e o `videoRef` para atribuir o srcObject quando ambos estiverem disponiveis.

### 2. Facial deve ser fullscreen dentro do celular
Atualmente o `PlaygroundAssinatura` envolve tudo em um `Card`. Para o modo facial (estado capturing), o conteudo deve preencher toda a tela do celular, sem Card, sem padding -- simulando a experiencia real de camera fullscreen.

### 3. Mobile deve mostrar fullscreen sem frame de celular
Quando o usuario esta em um dispositivo mobile real, nao faz sentido mostrar um celular dentro do celular. O conteudo deve aparecer direto em tela cheia.

---

## Mudancas por Arquivo

### `src/components/portal/signatures/SignatureFacial.tsx`

**Fix da camera:**
- Adicionar `useEffect` que observa `stream` e atribui `videoRef.current.srcObject = stream` quando o video element existir
- Remover a atribuicao de `srcObject` de dentro do `startCamera` (que roda antes do video estar no DOM)

```text
useEffect(() => {
  if (stream && videoRef.current) {
    videoRef.current.srcObject = stream;
  }
}, [stream, step]);
```

**Modo fullscreen (nova prop `fullscreen`):**
- Adicionar prop opcional `fullscreen?: boolean`
- Quando `fullscreen` e true e estado e `capturing`:
  - Remover espacamento externo, o container do video ocupa `absolute inset-0` preenchendo o pai inteiro
  - Progresso fica sobreposto na parte inferior
- Quando `fullscreen` e true e estado e `idle`:
  - Mostrar tela de inicio centralizada com fundo escuro, ocupando todo o espaco

### `src/pages/SignsPage.tsx`

**PlaygroundAssinatura - facial fullscreen:**
- Quando `type === "facial"`, nao renderizar dentro de Card
- Renderizar `SignatureFacial` diretamente com `fullscreen={true}`, ocupando toda a area de conteudo do celular
- O container de conteudo do celular perde padding quando for facial

**Mobile responsivo:**
- Importar `useIsMobile` 
- Quando `isMobile` for true:
  - Nao renderizar o frame do celular (bezel, status bar, home indicator)
  - Renderizar o conteudo diretamente em tela cheia
  - Badges ficam no topo como overlay ou barra fixa

---

## Detalhes Tecnicos

### SignatureFacial.tsx - Camera Fix

O problema raiz e uma race condition: o elemento `<video>` so existe no DOM quando `step === "capturing"`, mas `startCamera` tenta acessar `videoRef.current` antes de mudar o step. A solucao e um effect que sincroniza o stream com o video element apos a renderizacao.

### SignatureFacial.tsx - Modo Fullscreen

Estado `idle` com fullscreen:
- Fundo escuro (`bg-foreground/95`) ocupando todo o container
- Icone, instrucoes e botao centralizados

Estado `capturing` com fullscreen:
- Video ocupa `absolute inset-0` com `object-cover`
- FaceOverlay ja e absolute, funciona sem mudancas
- Barra de progresso sobreposta no bottom com `absolute bottom-0`

Estado `done` com fullscreen:
- Grid de fotos com fundo semi-transparente

### SignsPage.tsx - Conteudo condicional

```text
// No container de conteudo do celular:
<div className={`flex-1 overflow-y-auto ${
  playgroundStep === "assinatura" && playgroundType === "facial" ? "" : "p-3"
}`}>
```

PlaygroundAssinatura para facial:
- Sem Card wrapper
- SignatureFacial recebe `fullscreen={true}` e `className="h-full"`

### SignsPage.tsx - Mobile

```text
const isMobile = useIsMobile();

// Se mobile, renderizar conteudo direto sem phone frame
{isMobile ? (
  <div className="w-full min-h-[80vh] bg-background rounded-xl overflow-hidden border">
    {/* conteudo direto */}
  </div>
) : (
  <div className="relative w-[320px] bg-foreground/90 rounded-[3rem] ...">
    {/* phone frame */}
  </div>
)}
```

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/components/portal/signatures/SignatureFacial.tsx` | Fix camera (useEffect para srcObject), prop fullscreen para modo tela cheia |
| `src/pages/SignsPage.tsx` | Facial sem Card (fullscreen no celular), mobile sem phone frame, padding condicional |

