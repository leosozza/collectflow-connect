

## Plano — Corrigir erro de CSS que impede o sistema de carregar

### Causa
Em `src/index.css`, o `@import` da fonte Google está na **linha 5**, depois das diretivas `@tailwind` (linhas 1-3). A regra CSS exige que **todo `@import` venha antes de qualquer outra declaração** (exceto `@charset`/`@layer` vazio). Vite está bloqueando o CSS:

```
[vite:css] @import must precede all other statements
```

Resultado: estilos não carregam → tela em branco / "sistema não carrega".

### Correção
Mover o `@import` da fonte para a **linha 1**, antes dos `@tailwind`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base { ... }
```

### Arquivo
- `src/index.css` — reordenar 5 linhas no topo.

### Sem alteração
Restante do CSS, schema, componentes, lógica.

