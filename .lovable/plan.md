

# Plano: Melhorias na Landing Page

## 1. Rota dedicada `/site`
A landing page só aparece em `/` quando o usuário não está logado. Adicionar rota `/site` no `App.tsx` que sempre mostra a `LandingPage`, independente de estar logado ou não.

## 2. Animações sutis de fundo
Adicionar partículas/formas geométricas flutuantes atrás do hero e das seções, usando `framer-motion`. Círculos e linhas com movimento lento, baixa opacidade (~5-10%), sem chamar atenção mas dando vida à página.

## 3. Botão "Teste Grátis 14 Dias" — texto invisível
O botão usa `variant="outline"` com `text-white` sobre fundo escuro, mas na área hero o `border-white/20` funciona. O problema é que o `Button` outline tem cor de texto padrão que conflita. Corrigir forçando `text-white` e garantindo contraste.

## 4. Trocar "Relatórios em Tempo Real"
No array `features`, substituir título e descrição:
- De: "Relatórios em Tempo Real" / "Dashboards com métricas..."
- Para: "Analytics e Dashboard" / "Painéis analíticos com métricas de recuperação, aging, performance de operadores e muito mais."

## 5. Remover seção "Resultados Comprovados"
Remover o bloco inteiro das linhas 277-295 (seção com métricas duplicadas que já aparecem no hero).

## 6. Preços reais — sem plano grátis
Atualizar o array `plans`:
- **Plano 1**: "Essencial" — R$ 499,99/mês (substituir o "Starter Grátis")
- **Plano 2**: "Pro" — R$ 999,99/mês (substituir R$ 497)
- **Plano 3**: "Enterprise" — Sob medida (manter)
- Atualizar features de cada plano adequadamente
- Trocar CTAs: remover "Comece Grátis", usar "Contratar" / "Falar com Vendas"

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Adicionar rota `/site` apontando para `LandingPage` |
| `src/pages/LandingPage.tsx` | Animações de fundo, fix botão, trocar texto features, remover seção Resultados, atualizar preços |

