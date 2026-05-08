## Animação de carregamento — Meta de Equipe + Visão 360

Estender a animação de entrada do dashboard com efeito de "preenchimento progressivo" nos dois cards de destaque, durando ~2,5s.

### Comportamento

- **Meta de Equipe (`DashboardMetaCard` / `MetaRadialCard`)**: o gauge radial já anima de 0% até o valor real. Hoje a duração é `1.4s` — ajustar para `2.5s` para um preenchimento mais lento e perceptível.
- **Visão 360 (`Visao360Card`)**: as 4 barras horizontais (Colchão, Provisionado, Pendentes, Quebra) hoje aparecem já no tamanho final. Passarão a iniciar com `width: 0%` e animar até `widthPct` em ~2,5s com easing suave (`cubic-bezier(0.22, 1, 0.36, 1)`), começando logo após o stagger de entrada do card (~180ms). A linha-resumo "Projeção Receita do Mês" continua aparecendo direto (não tem barra).
- Quando o usuário trocar de mês/filtro e os valores mudarem, a barra anima suavemente do valor antigo para o novo (transição CSS já existente). A animação "do zero" só acontece no primeiro mount.
- Respeita `prefers-reduced-motion`: usuários com movimento reduzido veem o valor final direto, sem animação.

### Mudanças por arquivo

1. **`src/components/dashboard/Visao360Card.tsx`**
   - Adicionar estado `mounted` (useState + useEffect com `requestAnimationFrame`) que vira `true` logo após a primeira renderização.
   - Na `renderRow`, aplicar `width: mounted ? ${widthPct}% : 0%` e `transition: width 2.5s cubic-bezier(0.22, 1, 0.36, 1)` no inline style do preenchimento da barra.
   - Detectar `prefers-reduced-motion` (matchMedia) — se ativo, iniciar `mounted = true` imediatamente para pular a animação.

2. **`src/components/dashboard/DashboardMetaCard.tsx`**
   - Trocar `duration={1.4}` por `duration={2.5}` na chamada do `<MetaRadialCard>`.
   - O `MetaRadialCard` já usa `framer-motion` `animate(0 → percent, { duration })` — sem mudanças nesse componente.

### Identidade visual

- Sem novas cores, sem novas libs.
- Easing `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint) dá sensação de "trilha enchendo rápido e desacelerando" — combina com o gauge radial que tem easing similar do framer-motion.

### Fora deste plano

- Animar números das barras (counter contando de 0 até o valor) — só a largura da barra anima; o valor em texto aparece direto.
- Animar outros cards (KPIs, Total Recebido, Parcelas, Agendamentos).
- Re-disparar a animação ao trocar de filtros.
