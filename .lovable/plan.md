
## Adicionar as 5 Fases Estratégicas ao Roadmap

### Objetivo

Inserir os 5 blocos de funcionalidades avançadas ("O Agente Autônomo", "N8N Embutido", "Multicanal", "Smart Payments", "ML Preditivo") como novos cards no Roadmap, mantendo o padrão visual e de dados já existente.

### Análise do Estado Atual

O arquivo `src/pages/RoadmapPage.tsx` já possui a estrutura completa com:
- Interface `RoadmapItem` com campos: `id`, `title`, `description`, `status`, `progress`, `category`, `lovablePrompt`
- 4 status possíveis: `done`, `in_progress`, `planned`, `future`
- Array `roadmapData[]` com 26 itens existentes
- Exibição agrupada por status com cards, barra de progresso e botão "Copiar contexto"

### Itens a Adicionar

Serão adicionados **12 novos cards**, todos nas seções `"planned"` ou `"future"`, agrupados pelas 5 fases:

| # | Título | Status | Categoria | Progresso |
|---|--------|--------|-----------|-----------|
| 1 | Políticas de Desconto Dinâmico | planned | IA | 5% |
| 2 | Agente IA Autônomo de Negociação | planned | IA | 0% |
| 3 | Análise de Sentimento do Devedor | future | IA | 0% |
| 4 | Construtor Visual de Fluxos (N8N Embutido) | future | Automação | 0% |
| 5 | Motor de Execução de Fluxos | future | Automação | 0% |
| 6 | Grupos de WhatsApp — Mutirão IA | future | Contact Center | 0% |
| 7 | Transição de Canal Inteligente | future | Automação | 0% |
| 8 | Pix QR Code Dinâmico com Juros em Tempo Real | planned | Integrações | 0% |
| 9 | Webhook de Baixa Automática | planned | Integrações | 0% |
| 10 | Split de Pagamento (Comissão + Credor) | future | Financeiro | 0% |
| 11 | Dashboard de ROI — IA vs Humano | future | IA | 0% |
| 12 | Régua Inversa Preventiva & Lead Scoring Avançado | future | IA | 0% |

### Cada card terá um `lovablePrompt` detalhado

Cada item terá um prompt técnico completo com:
- Referência exata aos arquivos existentes do projeto
- Tabelas do banco já existentes relevantes
- Edge functions a criar
- Passo a passo de implementação aproveitando o código já pronto

### Único Arquivo Modificado

| Arquivo | Ação |
|---|---|
| `src/pages/RoadmapPage.tsx` | Inserir 12 novos objetos no array `roadmapData[]` (linhas 23–544) |

Nenhum novo arquivo, nenhuma mudança de lógica ou visual — apenas a adição dos dados no array existente. O sistema de agrupamento, busca, filtros e cards já vai exibir os novos itens automaticamente com o visual correto.

### Categorias adicionadas

Os novos itens usam categorias novas (`"Automação"`, `"Financeiro"`) que serão exibidas nos badges de categoria corretamente, pois o badge é renderizado dinamicamente com o valor do campo `category`.

### Resultado esperado

O Roadmap passará de 26 para 38 itens, com a seção `"Futuro"` crescendo significativamente e `"Planejado"` recebendo 4 novos itens relacionados a Smart Payments e IA de Negociação, refletindo a visão estratégica do produto como orquestrador de crédito autônomo baseado em IA.
