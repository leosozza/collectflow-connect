

## Plano: Melhorar visual do Gauge e organizar a pagina Gamificacao

### Alteracoes

#### 1. `src/components/gamificacao/GoalsTab.tsx` — Gauge mais bonito
- Aumentar o SVG (viewBox maior, raio maior) para ocupar mais espaco
- Adicionar sombra/glow nos segmentos coloridos do arco
- Porcentagem central maior e mais destacada com cor dinamica (vermelho/amarelo/verde conforme progresso)
- Adicionar icone ou emoji no centro quando meta atingida
- Cards "Meta Recebimento" e "Realizado" com bordas coloridas e icones
- Fundo sutil com gradiente no card principal
- Remover `max-w-xl` para ocupar mais largura
- Adicionar animacao suave no needle com framer-motion (ja instalado)

#### 2. `src/pages/GamificacaoPage.tsx` — Organizar melhor a pagina
- Remover o card duplicado "Meta do Mes" com Progress bar (linhas 103-123) ja que a aba Metas tem o gauge completo
- Reorganizar os 4 stat cards hero com visual mais limpo: adicionar gradientes sutis e bordas coloridas
- Manter a ordem de abas com Metas primeiro para operadores

### Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/components/gamificacao/GoalsTab.tsx` | Gauge SVG redesenhado, maior, com cores dinamicas e cards estilizados |
| `src/pages/GamificacaoPage.tsx` | Remover card duplicado de meta, melhorar visual dos stat cards |

