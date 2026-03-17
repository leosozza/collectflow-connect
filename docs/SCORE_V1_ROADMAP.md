# Score Operacional V1 — Roadmap de Evolução

## Visão Geral

O `propensity_score` é o **único score oficial** do RiVO Connect. A partir da V1, ele deixa de ser um score financeiro/heurístico e passa a ser um **score operacional** baseado no histórico real de interações do cliente.

---

## Fase 1 — Score Operacional V1 ✅ (Implementação Atual)

### O que foi implementado
- **Tabela `client_events`**: timeline unificada consolidando dados de `call_dispositions`, `call_logs`, `chat_messages`, `agreements`, `agreement_signatures` e `message_logs`
- **6 triggers automáticos** para popular `client_events` em tempo real
- **Motor de cálculo heurístico** com 4 dimensões:
  - Contato (25%) — conseguimos falar com o cliente?
  - Engajamento (20%) — o cliente interage e demonstra abertura?
  - Conversão (35%) — o cliente negocia e formaliza?
  - Credibilidade (20%) — quando formaliza, cumpre?
- **Pesos por fonte**: operador (45%), sistema (35%), prevenção (20%)
- **Peso de recência**: 7d=100%, 8-30d=70%, >30d=40%
- **Metadados auxiliares**: `preferred_channel`, `suggested_queue`, `score_reason`, `score_confidence`
- **Edge function `backfill-client-events`** para população inicial
- **Score base**: clientes sem histórico entram com score=50, confidence=low

### Dependências
- Nenhuma dependência externa
- Motor 100% heurístico, determinístico e auditável

---

## Fase 2 — Melhoria de Dados e Vinculação

### O que entra
- **Vinculação automática WhatsApp↔cliente** por telefone (eliminar vinculação manual)
- **Contadores materializados por CPF** (total de tentativas, total de respostas, etc.)
- **Promessas estruturadas** como tipo de evento (substituir texto livre)
- **event_source padronizado** com enum no banco
- **Melhoria de confiabilidade do score** com mais sinais

### Dependências técnicas
- Fase 1 concluída
- Tabela `client_phones` já existente

### Opcional
- Dashboard de eventos por cliente
- Filtros por `suggested_queue` na CarteiraPage

---

## Fase 3 — Inteligência por Voz e Texto

### O que entra
- **Speech-to-text** para gravações 3CPlus
- **Análise de IA em chamadas** (intenção, objeção, abertura para negociação)
- **Análise de IA em WhatsApp** (sentimento, intenção, chance de cumprimento)
- **Extração de canal preferido** via análise de resposta
- **Recomendação de abordagem** baseada no histórico

### Dependências técnicas
- Fase 2 concluída (vinculação automática)
- API de Speech-to-text (Google/OpenAI Whisper)
- Custos de processamento (tokens)
- Gravações acessíveis via URL (já funciona com 3CPlus)

### O que é necessário
- Edge function para transcrição
- Edge function para análise semântica
- Nova dimensão "IA" no motor de score (peso a definir)

### O que é opcional
- Análise de tom de voz
- Classificação automática de objeções

---

## Fase 4 — Score Avançado e Dashboards

### O que entra
- **IA complementar no cálculo do score** (5ª dimensão)
- **Ajuste fino por credor/carteira** (pesos diferentes por contexto)
- **Dashboards operacionais do score** (distribuição, evolução, comparativos)
- **Explicabilidade ampliada** (detalhar cada dimensão no frontend)
- **Score por cohort** (agrupar clientes similares)
- **A/B testing de abordagem** baseado no score

### Dependências técnicas
- Fase 3 concluída
- Volume de dados suficiente para calibração
- Dashboards de relatórios existentes

### O que é necessário
- Configuração de pesos por credor (admin)
- Componentes de visualização do score detalhado

### O que é opcional
- Machine learning supervisionado
- Predição de churn
- Score de portfólio (não individual)

---

## Ordem Ideal de Construção

```
Fase 1 → Fase 2 → Fase 3 → Fase 4
  ↓          ↓          ↓          ↓
Motor V1   Dados     Voz/Texto  Avançado
(heurístico) (qualidade) (IA)    (dashboards)
```

Cada fase é **independente** e pode ser entregue em produção sem depender da próxima. A arquitetura foi desenhada para evolução incremental sem retrabalho.

---

## Princípios

1. **Um único score** — `propensity_score` é o único campo exposto no sistema
2. **Determinístico antes de probabilístico** — heurística primeiro, IA depois
3. **Auditável** — `score_reason` explica o motivo
4. **Incremental** — cada fase agrega sem quebrar a anterior
5. **Sem score paralelo** — nunca criar um segundo score para o usuário final
