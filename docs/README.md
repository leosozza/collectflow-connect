# Manual de Governança para IA (Antigravity & Lovable)

Este documento define regras obrigatórias para qualquer inteligência artificial que manipule este repositório.

## 🛑 REGRAS CRÍTICAS (NÃO VIOLAR)

### 1. Multi-Tenant Sagrado
- **TODA** query ao banco de dados deve obrigatoriamente incluir o filtro `.eq("tenant_id", tid)`.
- Funções de serviço (services/) devem aceitar `tenantId` como parâmetro opcional para garantir isolamento em visualizações administrativas.

### 2. Integridade da Documentação (Obsidian)
- Arquivos em `docs/rivo-vault/` fazem parte de um grafo de conhecimento.
- **NUNCA** remova ou altere links entre colchetes duplos `[[ Link ]]`. Eles são essenciais para a navegação do arquiteto.
- Se for atualizar um documento, preserve os cabeçalhos e rodapés de navegação.

### 3. Centralização de Metas
- A fonte única de verdade para metas é a tabela `operator_goals`.
- Metas de Equipe são calculadas dinamicamente via código (Soma dos membros).
- Não re-introduzir o campo `meta_mensal` na tabela ou UI de Equipes.

### 4. Integridade Financeira
- O cálculo de "Saldo Devedor" deve sempre abater pagamentos confirmados (manuais/portal/negociarie) da dívida original.

---

## 📂 Estrutura de Documentação
- `docs/rivo-vault/`: Cérebro do projeto (Obsidian).
- `docs/README.md`: Este manual.

---
[[RIVO_BRAIN]]
