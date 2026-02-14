

# Detecção Facial Real com MediaPipe Face Landmarker

## Problema Atual

O componente `FaceLandmarks` exibe pontos fixos em coordenadas hardcoded (ex: olho esquerdo sempre em cx=120, cy=170). Eles nao se movem e nao acompanham o rosto real da camera. E apenas uma animacao decorativa.

## Solucao

Integrar a biblioteca **@mediapipe/tasks-vision** (Google MediaPipe) para detectar landmarks faciais reais em tempo real a partir do video da camera. Os pontos de olhos, nariz, boca e mandibula vao acompanhar o rosto real do usuario.

## Como funciona

1. Ao iniciar a camera, o MediaPipe FaceLandmarker e carregado (modelo ~4MB baixado via CDN)
2. A cada frame do video, o modelo detecta 468+ pontos 3D no rosto
3. Os pontos relevantes (olhos, nariz, boca, mandibula) sao extraidos e mapeados para coordenadas SVG
4. O overlay SVG renderiza os pontos e conexoes nas posicoes reais do rosto
5. Se nenhum rosto for detectado, exibe mensagem "Posicione seu rosto"

## Alteracoes

### 1. Instalar dependencia

- `@mediapipe/tasks-vision` - biblioteca oficial do Google para deteccao facial no browser

### 2. Reescrever `FaceLandmarks.tsx`

Transformar de componente estatico para componente que recebe uma ref do video e faz deteccao em tempo real:

- Receber `videoRef` como prop (referencia ao elemento video da camera)
- Inicializar `FaceLandmarker` com modelo `face_landmarker.task` (float16, ~4MB, carregado via CDN do Google Storage)
- Usar `requestAnimationFrame` para processar cada frame
- Extrair landmarks relevantes dos 468 pontos (indices especificos para olho esquerdo, olho direito, ponta do nariz, cantos da boca, mandibula)
- Converter coordenadas normalizadas (0-1) para coordenadas SVG (0-300 x 0-400)
- Considerar o espelhamento horizontal da camera (scaleX(-1))
- Manter as animacoes de glow e conexoes entre pontos
- Exibir status: "Detectando...", "Rosto detectado" ou "Posicione seu rosto"

### 3. Atualizar `SignatureFacial.tsx`

- Passar `videoRef` para o `FaceLandmarks` dentro do `FaceOverlay`
- Nenhuma outra alteracao necessaria no fluxo de captura

## Detalhes Tecnicos

### Indices dos landmarks MediaPipe usados

| Ponto | Indice MediaPipe | Descricao |
|---|---|---|
| Olho esquerdo | 468 (iris) ou 159 (palpebra superior) | Centro do olho esquerdo |
| Olho direito | 473 (iris) ou 386 (palpebra superior) | Centro do olho direito |
| Nariz | 1 (ponta) | Ponta do nariz |
| Boca esquerda | 61 | Canto esquerdo da boca |
| Boca centro | 13 (labio superior) | Centro da boca |
| Boca direita | 291 | Canto direito da boca |
| Mandibula esquerda | 234 | Lateral esquerda |
| Mandibula direita | 454 | Lateral direita |

### Inicializacao do modelo

```text
FilesetResolver.forVisionTasks(CDN_WASM_URL)
  -> FaceLandmarker.createFromOptions(resolver, {
       modelAssetPath: face_landmarker.task (float16),
       runningMode: "VIDEO",
       numFaces: 1
     })
```

### Loop de deteccao

```text
requestAnimationFrame -> 
  faceLandmarker.detectForVideo(video, timestamp) ->
  extrair landmarks[indices] ->
  converter (x * 300, y * 400) com espelhamento ->
  atualizar estado React (throttled ~30fps)
```

### Arquivos modificados

| Arquivo | Acao |
|---|---|
| `package.json` | Adicionar `@mediapipe/tasks-vision` |
| `src/components/portal/signatures/FaceLandmarks.tsx` | Reescrever com deteccao real via MediaPipe |
| `src/components/portal/signatures/SignatureFacial.tsx` | Passar `videoRef` para `FaceLandmarks` via `FaceOverlay` |

### Performance

- O modelo roda inteiramente no dispositivo (sem servidor)
- Usa WebAssembly + GPU delegate para velocidade
- Float16 e o modelo mais leve (~4MB)
- Throttle para ~30fps para nao sobrecarregar dispositivos moveis

