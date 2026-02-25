

## Plano: Pagina HERO do Sistema (Landing Page de Conversao)

### Objetivo
Criar uma landing page publica focada em conversao de vendas do RIVO CONNECT, acessivel em `/landing`. A pagina deve apresentar o sistema de cobranca, seus beneficios, e direcionar visitantes para criar conta ou agendar demonstracao.

### Estrutura da Pagina

```text
+--------------------------------------------------+
| HEADER (logo + nav sticky)                        |
|  [RIVO CONNECT]   Recursos  Precos  [Acessar]    |
+--------------------------------------------------+
|                                                    |
|  HERO SECTION                                      |
|  "Recupere mais dividas com menos esforco"         |
|  Subtitulo + CTA "Comece Gratis" + "Ver Demo"     |
|  Metricas animadas: +45% recuperacao, etc.         |
|                                                    |
+--------------------------------------------------+
|  SOCIAL PROOF BAR                                  |
|  "Mais de 500 empresas confiam no RIVO"            |
|  Logos/numeros de credores                          |
+--------------------------------------------------+
|  FEATURES GRID (3 colunas)                         |
|  - Automacao inteligente                           |
|  - Contact Center omnichannel                      |
|  - Portal do devedor                               |
|  - Gamificacao de equipe                           |
|  - Relatorios em tempo real                        |
|  - Integracoes (3CPlus, Gupshup, etc.)            |
+--------------------------------------------------+
|  COMO FUNCIONA (3 steps)                           |
|  1. Importe sua carteira                           |
|  2. Automatize reguas de cobranca                  |
|  3. Acompanhe resultados em tempo real             |
+--------------------------------------------------+
|  METRICAS / RESULTADOS                             |
|  Cards com numeros animados                        |
|  45% mais acordos, 3x mais produtividade, etc.    |
+--------------------------------------------------+
|  DEPOIMENTOS                                      |
|  Cards com quotes de clientes                      |
+--------------------------------------------------+
|  PRICING (3 planos)                                |
|  Starter / Pro / Enterprise                        |
+--------------------------------------------------+
|  CTA FINAL                                         |
|  "Pronto para transformar sua cobranca?"           |
|  [Comece agora gratuitamente]                      |
+--------------------------------------------------+
|  FOOTER                                            |
|  Links, contato, LGPD                              |
+--------------------------------------------------+
```

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/pages/LandingPage.tsx` | Novo - Pagina completa da landing |
| `src/App.tsx` | Adicionar rota `/landing` (publica, sem auth) |

### Detalhes Tecnicos

- **Rota publica**: `/landing` sem ProtectedRoute, sem AppLayout
- **Animacoes**: Usar `framer-motion` (ja instalado) para fade-in, scroll reveals e contadores animados
- **Responsivo**: Mobile-first com grid adaptativo
- **CTAs**: Botao principal leva para `/auth` (criar conta), botao secundario abre WhatsApp ou formulario
- **Cores**: Usar as variaveis CSS ja definidas (primary orange `#FF7F00`, secondary dark `#1A1D29`)
- **Logo**: Usar `src/assets/rivo_connect.png` ja existente
- **SEO**: Tags de titulo e meta description via `document.title`
- **Contador animado**: Numeros que incrementam ao entrar no viewport (useInView do framer-motion)
- **Sticky header**: Navbar fixa com transparencia que ganha fundo no scroll

### Secoes em Detalhe

1. **Hero**: Headline impactante + subtitulo + 2 CTAs + numeros animados de prova social
2. **Features**: 6 cards com icones lucide, titulo e descricao curta
3. **Como Funciona**: 3 passos com icones numerados e conexao visual
4. **Resultados**: 4 metricas grandes com animacao de contagem
5. **Depoimentos**: 3 cards com avatar, nome, cargo e quote
6. **Pricing**: 3 colunas (Starter gratuito, Pro, Enterprise) com feature list e CTAs
7. **CTA Final**: Fundo gradient dark com headline e botao grande
8. **Footer**: Links organizados em colunas + selo LGPD

