

# Playground Independente + Camera Real + Rotacao Landscape

## Resumo das mudancas

Tres ajustes principais na pagina Signs:

### 1. Badges do Playground independentes das configuracoes

Atualmente, clicar numa badge no playground altera o `signature_type` salvo no tenant (chama `updateTenant`). Isso esta errado -- o playground deve ser apenas uma simulacao local sem afetar a configuracao real.

**Mudanca em `SignsPage.tsx`:**
- Adicionar um estado local `playgroundType` (iniciando em "click") separado de `signatureType` (que e a configuracao salva)
- As badges do playground alteram apenas `playgroundType` sem chamar `updateTenant`
- O componente `PlaygroundAssinatura` recebe `playgroundType` em vez de `activeType`
- Remover toda a logica async dos badges (sem mais `updateTenant` / `refetch` no playground)

### 2. Camera real no Reconhecimento Facial

O componente `SignatureFacial` ja implementa a camera corretamente com `getUserMedia` chamado no click do botao "Iniciar Captura". O fluxo ja funciona:
- Estado `idle`: mostra botao "Iniciar Captura"
- Click chama `startCamera` que faz `getUserMedia` direto no handler (padrao correto de gesture)
- Estado `capturing`: mostra video com overlay do rosto (oval, landmarks, instrucoes)
- Captura 3 fotos automaticamente com countdown

Nenhuma mudanca necessaria no `SignatureFacial.tsx` -- a camera ja abre de verdade. Se nao estava funcionando antes, era porque o preview do Lovable pode bloquear permissoes de camera. O componente em si esta correto.

### 3. Rotacao do celular para landscape na assinatura "Desenho"

Quando o tipo selecionado for "draw", o frame do celular deve girar 90 graus para simular o modo paisagem, dando mais espaco horizontal para o cliente desenhar.

**Mudanca em `SignsPage.tsx`:**
- Quando `playgroundStep === "assinatura"` e `playgroundType === "draw"`, aplicar uma transformacao CSS no container do celular: `rotate(90deg)` com transicao suave
- Ajustar as dimensoes: o frame passa de `320x640` para `640x320` (visualmente rotacionado)
- Usar `transition-transform duration-500` para animar a rotacao
- Quando voltar para outro step ou outro tipo, o celular retorna a posicao vertical

## Detalhes Tecnicos

### Arquivo: `src/pages/SignsPage.tsx`

**Novo estado local:**
```text
const [playgroundType, setPlaygroundType] = useState<"click" | "facial" | "draw">("click");
```

**Badges simplificadas (sem async/updateTenant):**
- Cada badge apenas faz `setPlaygroundType(type)` e `resetPlayground()`
- Estilo: a badge ativa e determinada por `playgroundType` (nao mais `activeType`)

**Rotacao do frame mobile:**
- Calcular `isLandscape = playgroundStep === "assinatura" && playgroundType === "draw"`
- No container do celular, aplicar classe condicional:
  - Vertical (padrao): `w-[320px]`, inner height `640px`
  - Landscape (draw): aplicar `transform rotate-90` no container externo, mantendo as mesmas dimensoes internas mas visualmente rotacionado
- Adicionar `transition-all duration-500 ease-in-out` para animar suavemente

**Componente PlaygroundAssinatura:**
- Recebe `playgroundType` em vez de `activeType`

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/SignsPage.tsx` | Estado local para playground, badges sem updateTenant, rotacao landscape para draw |

Nenhum arquivo novo. Nenhuma mudanca nos componentes de assinatura (`SignatureFacial`, `SignatureDraw`, `SignatureClick`) -- eles ja funcionam corretamente.
