
# Rebrand para RIVO CONNECT

## O que muda

### 1. Nome do sistema
- `index.html`: título da aba, meta tags og:title e og:description
- `src/pages/AuthPage.tsx`: texto "Connect Control" → "RIVO CONNECT"
- `src/components/AppLayout.tsx`: fallback "Connect Control" → "RIVO CONNECT" e substituição do ícone Zap pelo logo

### 2. Paleta de cores

A paleta atual usa laranja `hsl(24, 95%, 53%)` (#F97316) e escuro `hsl(220, 20%, 22%)` (#2D3748). A nova paleta substitui por:

| Token | Atual | Novo |
|---|---|---|
| `--primary` | hsl(24, 95%, 53%) | hsl(30, 100%, 50%) — #FF7F00 |
| `--accent` | hsl(24, 95%, 53%) | hsl(30, 100%, 50%) |
| `--ring` | hsl(24, 95%, 53%) | hsl(30, 100%, 50%) |
| `--sidebar-background` (light) | hsl(220, 20%, 22%) | hsl(228, 24%, 13%) — #1A1D29 |
| `--secondary` | hsl(220, 20%, 22%) | hsl(228, 24%, 13%) |
| `--sidebar-primary` | hsl(24, 95%, 53%) | hsl(30, 100%, 50%) |
| `.gradient-orange` | linear-gradient laranja antigo | linear-gradient #FF7F00 → #FF9A33 |
| `.gradient-dark` | linear-gradient escuro antigo | sólido/gradient #1A1D29 → #222538 |

### 3. Logo

- Copiar `user-uploads://rivo_connect_dark.png` → `src/assets/rivo_connect.png`
- **`AppLayout.tsx`**: substituir o bloco `<div gradient-orange><Zap/></div>` por `<img src={rivoLogo} />` (altura 32px, sem fundo)
  - No modo **colapsado** mostrar só o ícone (logo menor ou apenas as letras R) — usar a imagem em tamanho reduzido
- **`AuthPage.tsx`**: substituir o bloco `<div gradient-orange><Zap/></div> + "Connect Control"` pelo logo completo em tamanho maior (altura 48px)

### 4. Favicon

- Copiar `user-uploads://rivo_connect_dark.png` → `public/favicon.png`
- Atualizar `index.html` com `<link rel="icon" href="/favicon.png" type="image/png">`

---

## Arquivos modificados

| Arquivo | O que muda |
|---|---|
| `index.html` | título, favicon, og:title |
| `src/index.css` | variáveis CSS de cor + `.gradient-orange` + `.gradient-dark` |
| `src/components/AppLayout.tsx` | logo image no lugar do ícone Zap |
| `src/pages/AuthPage.tsx` | logo image no lugar do ícone Zap + nome |
| `src/assets/rivo_connect.png` | novo arquivo (cópia do upload) |
| `public/favicon.png` | novo arquivo (cópia do upload) |

## Nenhuma alteração no banco de dados necessária.
