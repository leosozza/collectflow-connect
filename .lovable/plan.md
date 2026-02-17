
## Reestruturacao de Cadastros: Perfil do Devedor, Tipo de Status e Regras de Negocio

### 1. Renomear "Tipo de Devedor" para "Perfil do Devedor"

**O que muda:**
- No menu lateral de /cadastros, "Tipo de Devedor" vira "Perfil do Devedor"
- Os perfis padrao mudam para: Negligente, Cronico, Ocasional, Imprevisivel, Mau Pagador
- Cada perfil tera descricao pre-definida ao carregar os padrao

**Arquivos:** `CadastrosPage.tsx`, `TipoDevedorList.tsx`

---

### 2. Criar nova secao "Tipo de Status" em /Cadastros

**Nova tabela no banco:** `tipos_status`
- `id` (uuid, PK)
- `tenant_id` (uuid, NOT NULL)
- `nome` (text, NOT NULL)
- `descricao` (text)
- `cor` (text) -- cor para badge visual
- `regras` (jsonb) -- regras configuradas pelo admin (bloqueio de edicao, tempo de expiracao, auto-transicao)
- `created_at` (timestamp)

Os 6 status padrao serao:
1. Aguardando acionamento
2. Acordo Vigente
3. Quebra de Acordo
4. Quitado
5. Em negociacao
6. Risco de Processo

**Novo campo na tabela `clients`:**
- `status_cobranca_id` (uuid, FK para `tipos_status`, nullable)
- `status_cobranca_locked_by` (uuid, nullable) -- operador que travou
- `status_cobranca_locked_at` (timestamp, nullable) -- quando foi travado

**Componente novo:** `TipoStatusList.tsx` -- lista CRUD igual ao TipoDevedorList, com campos adicionais para configurar regras de cada status

**Menu lateral:** nova entrada "Tipo de Status" abaixo de "Tipo de Divida"

---

### 3. Regras de Negocio dos Status

As regras serao aplicadas no frontend e validadas no backend:

**Em Negociacao:**
- Ao marcar um cliente como "Em Negociacao", registra `status_cobranca_locked_by` e `status_cobranca_locked_at`
- Outros operadores nao podem editar esse cliente por 10 dias
- Apos 10 dias sem atualizacao, o status volta automaticamente para "Aguardando acionamento" (via edge function cron ou verificacao no frontend)

**Acordo Vigente:**
- Apenas o operador responsavel ou admin podem editar
- Demais operadores veem como somente leitura

**Quebra de Acordo:**
- Se a parcela nao for baixada em 3 dias, status muda automaticamente para "Quebra de Acordo"
- O cliente pode ser cobrado novamente mas o status permanece ate novo acordo

**Risco de Processo:**
- Exibe um alerta visual (badge vermelha) na carteira
- Ao criar filas/campanhas, clientes com esse status sao sinalizados para analise

**Aguardando acionamento:**
- Status padrao, cliente pode ser cobrado normalmente

**Quitado:**
- Somente leitura, nenhuma acao de cobranca disponivel

---

### 4. Perfil do Devedor no Card de Detalhes (/carteira/:cpf)

Dentro de "Mais informacoes do devedor" (secao colapsavel), adicionar um Select para escolher o Perfil do Devedor. Ao mudar, salva automaticamente no campo `tipo_devedor_id` do cliente.

---

### 5. Filtro de Status na Carteira (/carteira)

Adicionar filtro "Status de Cobranca" nos filtros avancados da Carteira (`ClientFilters.tsx`), carregando os tipos de status cadastrados. Util para criar campanhas de discador e WhatsApp filtrando por status especifico.

---

### Detalhes Tecnicos

**Migracao de banco de dados:**
1. Criar tabela `tipos_status` com RLS (mesmos padroes das demais tabelas: admin manage, tenant view)
2. Adicionar colunas `status_cobranca_id`, `status_cobranca_locked_by`, `status_cobranca_locked_at` na tabela `clients`

**Arquivos a criar:**
- `src/components/cadastros/TipoStatusList.tsx` -- CRUD de Tipos de Status com regras configuraveis

**Arquivos a modificar:**
- `src/pages/CadastrosPage.tsx` -- adicionar secao "Tipo de Status" no menu e renomear "Tipo de Devedor"
- `src/components/cadastros/TipoDevedorList.tsx` -- renomear labels e atualizar perfis padrao com descricoes
- `src/services/cadastrosService.ts` -- adicionar funcoes CRUD para `tipos_status`
- `src/components/client-detail/ClientDetailHeader.tsx` -- adicionar Select de Perfil do Devedor na area colapsavel
- `src/components/clients/ClientFilters.tsx` -- adicionar filtro por Status de Cobranca
- `src/pages/CarteiraPage.tsx` -- adicionar `statusCobrancaId` nos filtros e exibir badge de status na tabela
- `src/services/clientService.ts` -- atualizar interface Client com novos campos

**Edge function (futura):**
- `auto-status-update` -- rotina para verificar clientes "Em negociacao" com mais de 10 dias e "Quebra de acordo" com parcelas vencidas ha 3 dias. Pode ser implementada como cron ou verificacao no carregamento da pagina.
