
# Redesign do Portal - Inspirado no Acordo Certo

## Objetivo

Redesenhar a landing page e demais telas do portal do devedor para um visual moderno, limpo e profissional, inspirado no layout do Acordo Certo, mantendo as cores e identidade do tenant.

## Mudancas Visuais

### 1. PortalHero (Landing Page)

**Layout atual**: Banner gradient full-width com texto centralizado.

**Novo layout**:
- Fundo branco/claro (sem gradient pesado)
- Layout em duas colunas (desktop): texto a esquerda, ilustracao/grafico decorativo a direita
- Card branco com sombra sutil contendo o campo CPF
- Titulo grande com parte do texto na cor primaria do tenant (ex: "com ate 90% de desconto" em laranja)
- Subtitulo em cinza claro
- Botao de consulta na cor primaria do tenant
- Badge sutil acima do titulo ("Negocie online")
- Secao de beneficios abaixo com icones em circulos suaves e fundo claro

### 2. PortalLayout (Header e Footer)

- Header mais limpo e fino, com fundo branco e borda inferior sutil
- Footer minimalista com texto cinza

### 3. PortalDebtList (Lista de Dividas)

- Cards com bordas arredondadas maiores e sombras mais suaves
- Resumo no topo em card com fundo levemente colorido (tom claro da cor primaria)
- Badges mais modernos com cores suaves
- Espacamento mais generoso

### 4. PortalNegotiation (Simulador)

- Cards de opcao com hover mais suave
- Badges de desconto com fundo verde claro
- Visual mais espacado e limpo

## Arquivos Modificados

| Arquivo | Tipo de Mudanca |
|---|---|
| `src/components/portal/PortalHero.tsx` | Redesign completo do layout |
| `src/components/portal/PortalLayout.tsx` | Refinamento do header/footer |
| `src/components/portal/PortalDebtList.tsx` | Ajustes visuais nos cards |
| `src/components/portal/PortalNegotiation.tsx` | Ajustes visuais nos cards |

## Detalhes Tecnicos

- Nenhuma dependencia nova necessaria
- Uso de Tailwind CSS existente com classes utilitarias
- Cores dinamicas do tenant aplicadas via `style` inline onde necessario
- Layout responsivo: coluna unica em mobile, duas colunas em desktop
- Framer Motion ja disponivel para animacoes sutis de entrada (fade-in nos cards)
