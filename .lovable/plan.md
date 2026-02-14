# Cadastros - Novo Modulo Administrativo

## Resumo

Criar um novo modulo "Cadastros" no menu lateral do admin, com uma pagina dedicada contendo navegacao lateral interna para: **Credores**, **Equipes**, **Tipo de Devedor** e **Tipo de Divida**. Esses cadastros serao a base para futuras campanhas de cobranca com filtros avancados.

## Estrutura do Menu

O item "Cadastros" sera adicionado ao grupo "Avancado" no sidebar, com icone `Database`. Ao acessar `/cadastros`, o usuario vera um layout com menu lateral esquerdo (sub-navegacao) e conteudo a direita, similar a um padrao master-detail.

## Tabelas no Banco de Dados

### 1. `credores`

Armazena dados completos de cada credor (razao social, CNPJ, dados bancarios, gateway, parametros de negociacao, templates de documentos).

Colunas principais:

- `id`, `tenant_id`, `razao_social`, `nome_fantasia`, `cnpj`, `inscricao_estadual`
- `contato_responsavel`, `email`, `telefone`
- `cep`, `endereco`, `numero`, `complemento`, `bairro`, `cidade`, `uf`
- `banco`, `agencia`, `conta`, `tipo_conta`, `pix_chave`
- `gateway_ativo`, `gateway_token`, `gateway_ambiente`, `gateway_status`
- `parcelas_min`, `parcelas_max`, `entrada_minima_valor`, `entrada_minima_tipo` (percent/fixed), `desconto_maximo`, `juros_mes`, `multa`
- `honorarios_grade` (JSONB - array de faixas)
- `template_acordo`, `template_recibo`, `template_quitacao` (text)
- `status` (ativo/inativo), `created_at`, `updated_at`

### 2. `equipes`

- `id`, `tenant_id`, `nome`, `lider_id` (ref profiles), `meta_mensal`, `status`, `created_at`, `updated_at`

### 3. `equipe_membros`

Tabela de juncao N:N entre equipes e profiles.

- `id`, `equipe_id`, `profile_id`, `tenant_id`, `created_at`

### 4. `tipos_devedor`

- `id`, `tenant_id`, `nome` (ex: casual, recorrente, perda de emprego), `descricao`, `created_at`

### 5. `tipos_divida`

- `id`, `tenant_id`, `nome` (ex: boleto, cartao, promissoria), `descricao`, `created_at`

Todas as tabelas terao RLS com isolamento por `tenant_id`, acesso total para admins e visualizacao para operadores.

## Componentes e Arquivos

### Pagina principal

- `src/pages/CadastrosPage.tsx` - Layout com tabs laterais (Credores, Equipes, Tipo Devedor, Tipo Divida)

### Componentes de Credores

- `src/components/cadastros/CredorList.tsx` - Tabela com busca, paginacao, acoes editar/excluir
- `src/components/cadastros/CredorForm.tsx` - Dialog/Sheet com 3 abas internas:
  - Aba 1: Dados Cadastrais (razao social, CNPJ com mascara, contato, endereco)
  - Aba 2: Dados Bancarios e Gateway (banco, agencia, conta, PIX, gateway config)
  - Aba 3: Parametros de Negociacao (regras de acordo, grade de honorarios editavel, 3 editores de template com insercao de variaveis)

### Componentes de Equipes

- `src/components/cadastros/EquipeList.tsx` - Tabela com busca
- `src/components/cadastros/EquipeForm.tsx` - Formulario com multi-select de operadores, lider, meta

### Componentes de Tipos

- `src/components/cadastros/TipoDevedorList.tsx` - CRUD simples (nome + descricao)
- `src/components/cadastros/TipoDividaList.tsx` - CRUD simples (nome + descricao)

### Service

- `src/services/cadastrosService.ts` - Funcoes de CRUD para todas as 5 tabelas

## Credores - Detalhes das 3 Abas

### Aba 1 - Dados Cadastrais

Formulario com campos validados via Zod. CNPJ com mascara `00.000.000/0000-00`, telefone com mascara.

### Aba 2 - Dados Bancarios e Gateway

- Dropdown de bancos principais (Banco do Brasil, Itau, Bradesco, Santander, Caixa, etc.)
- Tipo conta: Corrente / Poupanca
- Gateway: dropdown com opcoes (Negociarie, Assas, Mercado Pago, PagSeguro, Outro)
- Ambiente: Producao / Homologacao
- Nota informativa sobre uso automatico do gateway

### Aba 3 - Parametros de Negociacao

- **Regras de Acordo**: campos numericos para parcelas min/max, entrada minima (toggle % ou R$), desconto maximo, juros, multa
- **Grade de Honorarios**: tabela editavel com botao "+ Adicionar Faixa". Cada linha tem: faixa de recuperacao (%) e honorarios (%). Armazenado como JSONB
- **Modelos de Documentos**: 3 textareas (Carta de Acordo, Recibo, Quitacao) com botao "Inserir Variavel" que abre dropdown com as variaveis disponiveis. Templates padrao pre-carregados

## Roteamento e Navegacao

- Nova rota `/cadastros` em `App.tsx`
- Novo item "Cadastros" com icone `Database` no `advancedNavItems` do `AppLayout.tsx`
- Pagina com sub-navegacao lateral (botoes verticais) para alternar entre as 4 secoes

## Sequencia de Implementacao

1. Migracoes SQL (5 tabelas + RLS)
2. Service layer (`cadastrosService.ts`)
3. Componentes de Tipos (mais simples, servem de base)
4. Componentes de Equipes
5. Componentes de Credores (mais complexo - 3 abas)
6. Pagina principal com sub-navegacao
7. Rota e item no menu lateral   
  
