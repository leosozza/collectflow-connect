
# Indicadores Visuais de Pontos Faciais no Reconhecimento

## O que muda

O overlay SVG existente no componente `SignatureFacial.tsx` sera substituido por uma versao muito mais visivel e profissional, com:

1. **Pontos maiores e brilhantes** nos olhos, nariz e boca (circulos com glow animado)
2. **Labels textuais** ao lado de cada ponto: "Olho esquerdo", "Olho direito", "Nariz", "Boca"
3. **Linhas de conexao** entre os pontos formando um mesh facial visivel (triangulacao entre olhos-nariz-boca)
4. **Animacao de "scanning"** - os pontos pulsam e as labels aparecem sequencialmente com um efeito de fade-in, simulando deteccao em tempo real
5. **Badge de status** mostrando "Pontos detectados: 7/7" com check animado

O efeito e puramente visual/cosmético (nao usa uma biblioteca de deteccao real), mas da ao usuario a confianca de que o sistema esta analisando seu rosto.

## Detalhes Tecnicos

### Arquivo: `src/components/portal/signatures/SignatureFacial.tsx`

**Substituicao do SVG overlay (linhas 34-45)**:

O SVG atual com `opacity-40` sera substituido por um novo com:

```
- Circulos maiores (r=5-6) com filtro de glow (feGaussianBlur)
- Opacidade total (sem opacity-40)
- Labels SVG <text> ao lado de cada ponto
- Animacao CSS keyframe para simular deteccao progressiva
- Linhas de conexao com strokeWidth maior e dasharray animado
- Pontos extras nas laterais do rosto (contorno da mandibula)
```

Pontos mapeados no viewBox 300x400:
| Ponto | Posicao | Label |
|---|---|---|
| Olho esquerdo | (120, 170) | "Olho E." |
| Olho direito | (180, 170) | "Olho D." |
| Nariz | (150, 215) | "Nariz" |
| Boca esquerda | (125, 255) | - |
| Boca centro | (150, 260) | "Boca" |
| Boca direita | (175, 255) | - |
| Orelha esquerda | (90, 200) | - |
| Orelha direita | (210, 200) | - |

**Novo componente `FaceLandmarks`** (inline no mesmo arquivo):
- Recebe `primaryColor` como prop
- Usa `useEffect` com timer para animar a "deteccao" dos pontos um a um
- Cada ponto aparece com scale animation de 0 para 1
- Apos todos detectados, mostra badge "Rosto detectado"

### Resultado visual esperado

- Ao iniciar a captura, os pontos aparecem um a um sobre o rosto (olho esquerdo, olho direito, nariz, boca...)
- Linhas conectam os pontos formando um triangulo facial
- Cada ponto tem um circulo externo com glow pulsante
- Labels aparecem brevemente ao lado de cada ponto detectado
- Um badge no topo muda de "Detectando..." para "Rosto detectado" com check verde

### Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/components/portal/signatures/SignatureFacial.tsx` | Novo overlay SVG com pontos faciais visiveis, labels, animacoes de deteccao e badge de status |
