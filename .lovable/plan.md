

# Plano de Implementacao - Connect Control

## Problema 1: Erro ao cadastrar cliente

**Causa raiz identificada:** Os logs do banco mostram o erro `infinite recursion detected in policy for relation "profiles"`. As politicas RLS da tabela `profiles` fazem consultas na propria tabela `profiles` para verificar se o usuario e admin, criando um loop infinito.

**Solucao:** Reescrever as politicas RLS para usar a funcao `has_role()` que ja existe no banco e opera com `SECURITY DEFINER` (ignora RLS, quebrando o loop).

### Alteracoes no banco de dados (migracao SQL):
- Remover as politicas atuais de `profiles` e `clients` que causam recursao
- Recriar todas as politicas usando `public.has_role(auth.uid(), 'admin')` no lugar de `EXISTS (SELECT 1 FROM profiles ...)`
- Isso resolve tanto o erro de cadastro quanto qualquer consulta que dependa de verificacao de perfil

---

## Funcionalidade 2: Aba "Carteira"

Nova pagina acessivel pelo menu lateral, posicionada abaixo de "Dashboard", com foco operacional para o negociador acompanhar seus clientes por periodo.

### Comportamento:
- Filtros por **Mes**, **Semana** e **Dia** (botoes de selecao rapida)
- Exibe apenas clientes com parcelas **pendentes** no periodo selecionado
- Lista com: Nome, CPF, Credor, Parcela, Valor, Data de Vencimento
- Destaque visual para vencimentos do dia atual
- O Dashboard perde a secao de "Clientes Inadimplentes" (que passa a existir apenas na Carteira)

### Arquivos envolvidos:
- **Novo:** `src/pages/CarteiraPage.tsx` - pagina com filtros e lista
- **Novo:** `src/components/carteira/CarteiraFilters.tsx` - botoes de filtro (Dia/Semana/Mes)
- **Novo:** `src/components/carteira/CarteiraTable.tsx` - tabela de clientes filtrados
- **Editar:** `src/App.tsx` - adicionar rota `/carteira`
- **Editar:** `src/components/AppLayout.tsx` - adicionar item "Carteira" no menu lateral
- **Editar:** `src/pages/DashboardPage.tsx` - remover secao de inadimplentes

---

## Funcionalidade 3: Importacao de clientes via planilha

Permitir que o negociador faca upload de uma planilha Excel (.xlsx) ou CSV para importar clientes em lote, sem precisar cadastrar um por um.

### Comportamento:
- Botao "Importar Planilha" ao lado do "Novo Cliente" na pagina de Clientes
- Abre um dialog de upload que aceita arquivos .xlsx e .csv
- Faz o parse da planilha no navegador usando a biblioteca `xlsx` (SheetJS)
- Mapeia as colunas conforme a estrutura da planilha de referencia:
  - Coluna A: Credor
  - Coluna B: Nome
  - Coluna C: CPF
  - Coluna D: N. da Parcela
  - Coluna E: Valor da Parcela
  - Coluna F: Valor Pago
  - Coluna G: Quebra (ignorado, e calculado automaticamente)
  - Coluna H: Data de vencimento
- Exibe preview dos dados antes de confirmar a importacao
- Insere todos os registros no banco de uma vez
- Exibe feedback de sucesso/erro com contagem de registros importados

### Arquivos envolvidos:
- **Instalar:** pacote `xlsx` para parsing de planilhas
- **Novo:** `src/components/clients/ImportDialog.tsx` - dialog de upload com preview e confirmacao
- **Novo:** `src/services/importService.ts` - logica de parsing e mapeamento da planilha
- **Editar:** `src/pages/ClientsPage.tsx` - adicionar botao de importacao
- **Editar:** `src/services/clientService.ts` - adicionar funcao `bulkCreateClients` para insercao em lote

---

## Detalhes tecnicos

### Migracao SQL (resumo):
```text
DROP POLICY "Admins can view all profiles" ON profiles;
DROP POLICY "Admins can update all profiles" ON profiles;
-- (e as demais politicas de admin em clients)

-- Recriar usando has_role():
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
-- (mesma abordagem para todas as politicas de admin)
```

### Mapeamento da planilha:
A importacao detecta automaticamente a linha de cabecalho (linha 3 da planilha, com "CREDOR", "NOME", "CPF", etc.) e ignora linhas anteriores de titulo. Os valores monetarios sao parseados removendo "R$" e tratando separador decimal brasileiro (virgula).

### Filtros da Carteira:
- **Dia:** filtra por data exata (hoje como padrao)
- **Semana:** filtra de segunda a domingo da semana selecionada
- **Mes:** filtra pelo mes/ano selecionado

