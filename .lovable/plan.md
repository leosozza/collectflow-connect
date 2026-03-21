

# Plano: Landing Page — Remover seções, fix botão, animações criativas

## Mudanças

### 1. Remover seções do hero
- **Remover métricas animadas** (linhas 234-249): os cards R$120M+, 500+, 45%, 70% no hero
- **Remover Social Proof** (linhas 253-263): seção "Empresas que confiam no RIVO Connect" com FinCred, RecuperaBR, etc.
- Remover `AnimatedCounter` component e `metrics` array (não mais usados)

### 2. Fix botão "Teste Grátis 14 Dias"
O botão outline com `!text-white` não funciona em produção (purge do Tailwind pode remover `!important`). Trocar para classe inline style ou usar `className="text-white bg-transparent border-white/20 hover:bg-white/10"` sem variant outline.

### 3. Animações de fundo — gráficos subindo
Criar componente `AnimatedBars` que renderiza barras verticais estilo gráfico de barras subindo e descendo lentamente no fundo com opacidade muito baixa (~5-8%). Posicionar atrás das seções de features e como funciona.

### 4. Efeitos hover interativos
- **Títulos das seções**: `whileHover={{ scale: 1.03 }}` com `transition`
- **Feature cards**: já tem `whileHover={{ y: -4 }}`, adicionar `scale: 1.02`
- **Pricing cards**: adicionar hover scale
- **Steps**: hover grow nos títulos
- **Nav links**: scale on hover
- **Testimonials**: hover lift

### 5. Mais vida geral
- Adicionar `FloatingShapes` também nas seções de features e pricing (com opacidade ainda menor)
- Adicionar efeito de parallax sutil nos títulos das seções usando `useScroll` do framer-motion
- Staggered animation nos feature cards (aparecem um por um)

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/LandingPage.tsx` | Remover metrics+social proof, fix botão, animações de barras no fundo, hover effects em todos os elementos interativos |

