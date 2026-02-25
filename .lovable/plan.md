

## Plano: Redesign da Hero Section - Foco B2B e Conversao

### Objetivo
Reescrever completamente a Hero Section da LandingPage existente (`/landing`) com foco em conversao B2B, aplicando a tecnica AIDA e direcionada a decisores (CFO, CEO, gestores financeiros).

### Mudancas na Rota
A rota raiz (`/`) atualmente leva ao dashboard (protegido). Para que `rivoconnect.lovable.app` mostre a landing page para visitantes nao logados, vou:
- Mover a landing page para a rota `/` como pagina publica
- Redirecionar usuarios logados para o dashboard automaticamente
- Manter `/landing` como alias

### Estrutura da Nova Hero

```text
+----------------------------------------------------------+
| HEADER sticky (logo + nav + CTAs)                         |
+----------------------------------------------------------+
|                                                            |
|  BADGE: "Plataforma lider em cobranca B2B"                |
|                                                            |
|  TITULO: "Sua Empresa Perde Dinheiro                      |
|           Cobrando do Jeito Errado"                        |
|                                                            |
|  SUBTITULO: Empresas que usam RIVO recuperam              |
|  ate 45% mais recebiveis em 90 dias —                     |
|  sem aumentar equipe e sem integracao complexa.           |
|                                                            |
|  [Fale com um Especialista]  [Teste Gratis 14 Dias]      |
|                                                            |
|  REMOCAO DE OBJECAO:                                      |
|  "Sem cartao" | "Setup em 24h" | "Funciona com seu ERP"  |
|                                                            |
|  METRICAS ANIMADAS:                                       |
|  R$120M+ recuperados | 500+ empresas | 45% mais acordos  |
|  | 70% menos tempo                                        |
|                                                            |
+----------------------------------------------------------+
|  SOCIAL PROOF BAR com logos                                |
+----------------------------------------------------------+
| ... restante da pagina (features, pricing, etc.)          |
+----------------------------------------------------------+
```

### Tecnica AIDA Aplicada

| Etapa | Elemento | Conteudo |
|-------|----------|----------|
| Atencao | Badge + Titulo | Frase provocativa que expoe o problema |
| Interesse | Subtitulo | Solucao clara com resultado numerico |
| Desejo | Metricas + Remocao de objecoes | Prova social + facilidade |
| Acao | 2 CTAs | Primario (contato) + Secundario (teste gratis) |

### Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/pages/LandingPage.tsx` | Reescrever Hero section com novo copy B2B, metricas maiores, CTAs duplos e remocao de objecoes |
| `src/App.tsx` | Adicionar logica para mostrar LandingPage na rota `/` para visitantes nao logados |

### Detalhes Tecnicos

**Hero Section:**
- Titulo principal provocativo: "Sua Empresa Perde Dinheiro Cobrando do Jeito Errado"
- Subtitulo com dados: "recuperam ate 45% mais recebiveis em 90 dias"
- 2 CTAs: "Fale com um Especialista" (WhatsApp) + "Teste Gratis 14 Dias" (link para /auth)
- Barra de remocao de objecoes com icones: sem cartao, setup rapido, compativel com ERP
- Metricas maiores com prefixo "R$" e contadores animados
- Background com gradiente dark + efeito radial sutil
- Animacoes framer-motion mantidas (fade-in, contadores)

**Roteamento:**
- Rota `/` verifica se usuario esta logado: se sim, mostra Dashboard; se nao, mostra LandingPage
- Usa o hook `useAuth` para verificar estado de autenticacao
- `/landing` continua funcionando como rota publica direta

**Social Proof:**
- Nomes de empresas fictcias na barra de logos
- Metricas: R$120M+ recuperados, 500+ empresas, 45% mais acordos, 70% menos tempo

**Responsividade:**
- Layout mobile-first
- CTAs empilhados em mobile, lado a lado em desktop
- Metricas em grid 2x2 mobile, 4 colunas desktop

