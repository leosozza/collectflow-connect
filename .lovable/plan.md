## Objetivo
Reverter o estilo do hero da landing page para a identidade antiga RIVO (fundo escuro, tipografia bold sans em Inter, laranja vibrante), mas **mantendo** as seções visuais do meio do novo layout (mockup WhatsApp, recursos, portal do credor, planos, FAQ). Adicionar mockup MacBook com dashboard, novo roteiro do WhatsApp e foco em conversão.

---

## 1. Hero — voltar ao estilo antigo (referência: IMG_1896)

**Visual:**
- Fundo `bg-[#0F1117]` (quase preto) com:
  - Pattern sutil de **conexões/nós** (SVG inline: pontos + linhas finas em `rgba(255,255,255,0.04)`) ocupando todo o hero — efeito "rede neural apagada".
  - Glow laranja radial atrás do título (`radial-gradient(circle at 30% 40%, rgba(255,127,0,0.15), transparent 60%)`).
- Remover `font-['Instrument_Serif']` do hero. Voltar a **Inter 800/900** já configurado no `tailwind.config.ts`.
- Pode remover o import de Instrument Serif do `index.css` (não será mais usado).

**Conteúdo (foco em conversão B2B para assessorias):**
- Badge: `PLATAFORMA PARA ASSESSORIAS DE COBRANÇA` (pill laranja translúcido).
- H1 (Inter black, 4xl→6xl): "Sua assessoria recupera **mais** cobrando do **jeito certo**" — palavra "mais" e "jeito certo" em laranja.
- Subhead branco/70: "WhatsApp oficial e não oficial, discador, score de IA e portal do credor — tudo em uma plataforma feita para quem vive de cobrança."
- 2 CTAs:
  - Primário grande laranja: **"Teste grátis 14 dias →"** (com glow `shadow-[0_0_40px_rgba(255,127,0,0.4)]`).
  - Secundário outline branco: **"Ver demonstração"** (scroll para mockup WhatsApp).
- Linha de trust badges (icones + texto branco/60): `Sem cartão · Setup em 24h · LGPD · Multi-tenant seguro`.
- KPIs ainda presentes mas redesenhados como 3 cards horizontais discretos abaixo dos CTAs (não em serif).

---

## 2. MacBook mockup com dashboard

Nova seção logo após o hero (antes de "Por que RIVO"):
- Frame de MacBook em CSS puro (moldura prata, tela `aspect-[16/10]`, base trapezoidal) — sem libs externas.
- Tela exibe screenshot real do dashboard. **Plano:** capturar print da rota `/dashboard` (já existente) e salvar em `src/assets/dashboard-preview.png`. Importar como ES6.
- Fundo da seção: gradiente claro `#FAFAF7 → #F0EDE5` com mesma textura de grid sutil que o resto.
- Headline acima: "Tudo o que você precisa em **uma única tela**" (Inter bold, preto sobre claro).

> **Nota técnica:** Não posso capturar o screenshot do dashboard sozinho em modo plano. Vou usar um **placeholder estilizado** (mockup desenhado em divs simulando o dashboard com KPIs, gráfico e tabela) até que o usuário forneça o print real. Quando ele enviar a imagem, troco o placeholder pelo asset.

---

## 3. Manter do design atual (parte do meio)

Preservar com leves ajustes para combinar com hero escuro:
- **Mockup WhatsApp animado** — manter, **trocar o roteiro** (ver §4).
- **Seção de recursos** (Score IA, WhatsApp multi-provider, Discador, Portal credor, Gamificação, Analytics) — manter cards.
- **Como funciona (4 passos)** — manter.
- **Para quem (3 personas)** — manter.
- **Portal do credor white-label** — manter mockup mini-dashboard.
- **Planos** — manter.
- **FAQ** — manter.
- **CTA final** — atualizar para "Teste grátis 14 dias" (consistência com hero).

Tipografia geral: **tudo em Inter** (sem mais serif itálico em lugar nenhum).

---

## 4. Novo roteiro do WhatsApp (não copiar CobreAI)

Mostrar a IA fazendo algo que CobreAI **não** mostra: **negociação com objeção real + escalonamento inteligente**.

```
[IN]  "Não tenho como pagar isso agora, tô desempregado."
[OUT] "Entendo, João. Posso te ajudar a montar uma proposta
       que caiba no seu bolso. Quanto você consegue pagar
       por mês, sem apertar?"            [score: 78% propensão]
[IN]  "Talvez uns 150 reais."
[OUT] "Fechado. Posso parcelar em 10x de R$ 152,30 com
       30% de desconto sobre o saldo. Topa?"
[IN]  "Topo!"
[OUT] "Acordo registrado ✅ Boleto da 1ª no seu WhatsApp."
       [card: Acordo #4821 · R$ 1.523,00 em 10x]
```

Tags flutuantes: "IA · negociando" + badge lateral "Escalonando para humano se score < 30%".

---

## 5. Detalhes técnicos

- Arquivos a editar: `src/pages/LandingPage.tsx` (rewrite hero + adicionar seção MacBook + atualizar mockup WhatsApp).
- `src/index.css`: remover import de Instrument Serif.
- Novo asset placeholder: `src/assets/dashboard-mockup-placeholder` (componente React, não imagem) — fácil substituir depois por `<img src={dashboardPreview}/>`.
- Pattern de conexões: SVG inline com `<circle>` + `<line>` posicionados em grid 6×4, opacidade 0.06, sem libs.
- Sem mudanças de backend, rotas ou lógica.

---

## 6. Conversão — princípios aplicados

1. **CTA primário acima da dobra** com glow + verbo de ação ("Teste grátis 14 dias").
2. **Prova visual imediata** — MacBook com dashboard real logo após o hero (mostra o produto, não promete).
3. **Demo interativa** — WhatsApp animado mostra a IA resolvendo objeção (gatilho emocional).
4. **Remoção de fricção** — "Sem cartão · Setup 24h" visível no hero.
5. **Hierarquia clara** — 1 CTA primário forte, 1 secundário, sem ruído.

---

## Validação

1. Hero escuro com pattern de conexões + tipografia Inter bold (sem serif).
2. MacBook visível na segunda dobra com placeholder do dashboard.
3. Mockup WhatsApp roda novo script de objeção.
4. CTAs unificados em "Teste grátis 14 dias".
5. Nenhuma fonte serif/itálica restante na página.