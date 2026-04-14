

# Documento PDF de Funcionalidades + Atualização do Roadmap

## Resumo

Gerar um PDF profissional listando todas as funcionalidades do RiVO Connect, categorizadas em: **Prontas**, **Em Desenvolvimento** e **Futuras**. Simultaneamente, atualizar o arquivo `docs/SCORE_V1_ROADMAP.md` para um roadmap geral do produto.

## PDF — Estrutura do Documento

**Título**: "RiVO Connect — Mapa de Funcionalidades"
**Formato**: PDF A4, cores da marca, gerado via ReportLab

### Seções do PDF:

**1. Funcionalidades Prontas (✅)**
- **CRM de Cobrança**: Carteira de clientes (tabela + kanban), detalhe do devedor, histórico, filtros avançados, importação de planilhas
- **Contact Center WhatsApp**: Chat em tempo real, múltiplas instâncias (Evolution/WuzAPI/Gupshup/Baylers), vinculação de cliente, tabulação na conversa, perfil do devedor (hover selector), disparo em lote com Anti-Ban
- **Contact Center Telefonia**: Integração 3CPlus, discador, tabulação de chamadas
- **Gestão de Acordos**: Calculadora de acordos, parcelas, assinatura digital (facial + digital), portal do devedor
- **Portal do Devedor**: Consulta por CPF, lista de dívidas, negociação, checkout com Asaas, assinatura biométrica
- **Documentos**: Geração de 5 tipos (acordo, recibo, quitação, descrição de dívida, notificação extrajudicial), templates por credor/tenant/default, preview A4, download PDF
- **Automação**: Réguas de cobrança, workflows visuais (ReactFlow), triggers automáticos (vencimento, sem contato), templates WhatsApp
- **Score Operacional V1**: Motor heurístico de 4 dimensões, timeline de eventos, recálculo automático, metadados (canal preferido, fila sugerida)
- **Gamificação**: Ranking, conquistas, metas, loja de recompensas, campanhas, carteira de pontos
- **Integrações**: Serasa, Protesto, TargetData (enriquecimento), Asaas (pagamentos), MaxSystem, CobCloud, Negociarie
- **Relatórios**: Aging, evolução, comparativos, exportação CSV/XLSX
- **Financeiro**: Despesas, checkout de pagamentos, comissões por faixa
- **Administração**: Multi-tenant, controle de módulos, gestão de usuários e roles, auditoria, sistema de tokens
- **IA**: Sugestão de respostas no WhatsApp, suporte via IA
- **API Pública**: REST API de clientes com documentação
- **Notificações**: Sistema em tempo real, celebração de acordos

**2. Em Desenvolvimento (🔧)**
- **Anti-Ban Backend Lock**: Throttling inteligente para disparos WhatsApp (8-15s + pausas de lote) — recém-implementado, em validação
- **Perfil do Devedor no Discador**: Seletor hover no atendimento telefônico
- **Score V1 — Calibração**: Ajuste fino dos pesos do motor heurístico com dados reais

**3. Funcionalidades Futuras (🔮)**
- **Score V2 — Vinculação automática WhatsApp↔cliente** por telefone
- **Score V3 — IA por Voz e Texto**: Speech-to-text, análise semântica de chamadas e WhatsApp
- **Score V4 — Avançado**: IA complementar, dashboards operacionais, A/B testing
- **IA Negociação WhatsApp**: Agente autônomo de negociação
- **IA Negociação Telefonia**: Agente de voz para negociação
- **Dashboard de eventos por cliente**
- **Machine Learning supervisionado** para predição

## Roadmap — Atualização

Criar/atualizar `docs/ROADMAP.md` com visão geral do produto (não apenas score), incluindo as fases acima.

## Arquivos

| Ação | Arquivo |
|---|---|
| Gerar | `/mnt/documents/RiVO_Connect_Funcionalidades.pdf` |
| Criar/Atualizar | `docs/ROADMAP.md` (roadmap geral do produto) |

