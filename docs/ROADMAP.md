# 🗺️ RiVO Connect — Roadmap do Produto

> Visão geral de todas as funcionalidades: prontas, em desenvolvimento e futuras.  
> Atualizado em: Abril 2026

---

## ✅ Funcionalidades Prontas (16 módulos)

### CRM de Cobrança
- Carteira de clientes (tabela + Kanban)
- Detalhe do devedor com histórico completo
- Filtros avançados (credor, status, faixa de valor, perfil, score)
- Importação de carteiras via XLSX/CSV
- Atribuição de operadores e distribuição de carteira

### Contact Center — WhatsApp
- Chat em tempo real com interface completa
- Múltiplas instâncias (Evolution, WuzAPI, Gupshup, Baylers)
- Vinculação automática de conversa ao cliente
- Tabulação na conversa e tags
- Seletor de perfil do devedor (hover)
- Disparo em lote com Anti-Ban (8-15s + pausas de lote)

### Contact Center — Telefonia
- Integração 3CPlus (discador preditivo)
- Tabulação de chamadas configurável
- Agendamento de callbacks
- Gravação de chamadas com reprodução

### Gestão de Acordos
- Calculadora inteligente (entrada + parcelas)
- Desconto por aging configurável por credor
- Fluxo de aprovação para descontos acima do limite
- Parcelas customizáveis (valores e datas)
- Quebra automática por inadimplência

### Portal do Devedor
- Consulta de dívidas por CPF (auto-atendimento)
- Negociação e simulação de acordos
- Checkout integrado com Asaas (boleto, PIX, cartão)
- Assinatura digital biométrica (facial)
- Personalização visual por credor

### Documentos
- 5 tipos: Acordo, Recibo, Quitação, Descrição de Dívida, Notificação Extrajudicial
- Templates em 3 níveis: Credor > Tenant > Padrão
- Placeholders dinâmicos, preview A4, download PDF
- Rastreabilidade via snapshots imutáveis

### Automação
- Réguas de cobrança automáticas
- Editor visual de workflows (ReactFlow)
- Triggers: vencimento, sem contato, status
- Templates WhatsApp com variáveis
- Motor serverless com pausa/resumo

### Score Operacional V1
- Motor heurístico: Contato (25%), Engajamento (20%), Conversão (35%), Credibilidade (20%)
- Timeline unificada (client_events) com 6 triggers automáticos
- Pesos por fonte: operador (45%), sistema (35%), prevenção (20%)
- Recência: 7d=100%, 8-30d=70%, >30d=40%
- Metadados: canal preferido, fila sugerida, confiança
- Score base 50 para clientes sem histórico

### Gamificação
- Ranking, conquistas, metas, loja de recompensas
- Campanhas por credor, carteira de pontos

### Integrações Externas
- Serasa, Protesto, TargetData, Asaas, MaxSystem, CobCloud, Negociarie

### Relatórios
- Aging, evolução, comparativos, exportação CSV/XLSX

### Financeiro
- Despesas, checkout de pagamentos, comissões por faixa

### Administração & Multi-Tenant
- Isolamento por tenant (RLS), módulos em cascata
- Roles: admin, gerente, supervisor, operador
- Auditoria, tokens, presets (Assessoria / Empresa Final)

### Inteligência Artificial
- Sugestão de respostas no WhatsApp
- Chat de suporte com IA
- Cálculo de propensão de pagamento

### API Pública
- REST API de clientes com API Key (hash SHA-256)

### Notificações
- Sistema em tempo real + celebração de acordos

---

## 🔧 Em Desenvolvimento

| Funcionalidade | Descrição | Status |
|---|---|---|
| **Anti-Ban Backend Lock** | Throttling 8-15s, pausa de lote 2min, checkpoint automático | Em validação |
| **Perfil do Devedor no Discador** | Seletor hover durante atendimento telefônico | Em implementação |
| **Score V1 — Calibração** | Ajuste de pesos com dados reais de produção | Aguardando dados |

---

## 🔮 Funcionalidades Futuras

### Fase 2 — Melhoria de Dados (Score V2)
- Vinculação automática WhatsApp ↔ cliente por telefone
- Contadores materializados por CPF
- Promessas estruturadas como tipo de evento
- Dashboard de eventos por cliente

### Fase 3 — IA por Voz e Texto (Score V3)
- Speech-to-text para gravações de chamadas
- Análise semântica (intenção, objeção, abertura)
- Análise de sentimento em WhatsApp
- Extração automática de canal preferido

### Fase 4 — Score Avançado (Score V4)
- IA como 5ª dimensão do score
- Dashboards operacionais (distribuição, evolução)
- Ajuste de pesos por credor/carteira
- A/B testing de abordagem

### IA Negociação WhatsApp
- Agente autônomo de negociação
- Simulação de acordos, envio de propostas, fechamento
- Escalação automática para operador humano

### IA Negociação Telefonia
- Agente de voz para negociação por telefone
- Integração com discador 3CPlus

### Machine Learning Supervisionado
- Modelo preditivo de propensão ao pagamento
- Predição de churn e score de portfólio

---

## Ordem de Evolução

```
Prontas (V1)  →  Em Dev  →  Score V2  →  Score V3  →  Score V4
     ↓              ↓           ↓            ↓            ↓
  16 módulos    Anti-Ban     Dados      Voz/Texto     Avançado
  operacionais  + Perfil   + Vinculação  + IA Semântica + Dashboards
                                                         ↓
                                              IA Negociação (WhatsApp + Voz)
                                                         ↓
                                                   Machine Learning
```

---

## Princípios

1. **Incremental** — cada fase agrega sem quebrar a anterior
2. **Determinístico antes de probabilístico** — heurística primeiro, IA depois
3. **Auditável** — toda ação tem rastro e explicação
4. **Multi-tenant nativo** — isolamento total entre empresas
5. **Backend-first para segurança** — limites críticos no servidor, nunca no frontend
