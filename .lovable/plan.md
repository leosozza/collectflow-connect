## Animação de entrada do Dashboard

Adicionar uma animação leve de entrada quando o usuário acessa `/dashboard`, sem alterar lógica, dados ou layout.

### Comportamento

- Cada um dos 6 cards (sections do grid principal) entra com **fade + slide up** sutil.
- Entrada **escalonada** (stagger) para criar sensação de fluidez — cada card aparece com ~60ms de atraso em relação ao anterior, na ordem de leitura (esquerda → direita, linha 1 → linha 2).
- Duração curta (~350ms), `ease-out`. Sem animação ao trocar de filtros/mês — só na montagem inicial da página.
- Respeita `prefers-reduced-motion`: usuários com movimento reduzido não veem a animação.

### Mudanças por arquivo

1. **`src/pages/DashboardPage.tsx`**
   - Adicionar a classe `animate-fade-in` (já existente em `tailwind.config.ts`) em cada uma das 6 `<section>` do grid (linhas ~274, 292, 304, 317, 332, 342).
   - Aplicar `animation-delay` inline crescente em cada section (0ms, 60ms, 120ms, 180ms, 240ms, 300ms) usando `style={{ animationDelay: "Xms" }}`.
   - Adicionar `animation-fill-mode: both` para evitar flicker antes do delay (via classe utilitária `[animation-fill-mode:both]` ou inline style).

2. Nenhuma mudança em outros componentes — a animação fica isolada na página, sem tocar nos cards individuais.

### Identidade visual

- Reaproveita o keyframe `fade-in` já definido em `tailwind.config.ts` (translateY 10px → 0 + opacity 0 → 1) — mesmo idioma de animação usado no resto do app.
- Sem novos keyframes, sem libs adicionais.

### Fora deste plano

- Animações em hover, em troca de filtros/mês, ou em re-fetch de dados.
- Animações internas dos cards (números contando, barras crescendo).
- Mudanças de layout, cores ou tipografia.
