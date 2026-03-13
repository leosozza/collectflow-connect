

# Criar documentação da árvore do projeto

## Arquivos a criar

### 1. `docs/PROJECT_TREE.md`
Árvore completa de diretórios e arquivos do projeto, organizada hierarquicamente em formato markdown com blocos `text`.

### 2. `docs/PROJECT_ARCHITECTURE.md`
Documento explicativo da arquitetura, cobrindo:
- Visão geral da estrutura
- Explicação de cada diretório principal (`src/pages`, `src/components`, `src/services`, `src/hooks`, `supabase/functions`, etc.)
- Padrões utilizados (domain-driven components, service layer, multi-tenant)
- Fluxo de dados (componente → service → Supabase)
- Convenções de nomenclatura

Ambos os arquivos serão baseados na estrutura atual do projeto, lidos via `list_dir`.

