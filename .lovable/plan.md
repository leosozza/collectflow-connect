# Melhorias em Cadastros, Carteira e Filtros

## 1. Navegacao - Mover /Cadastros para baixo de /Carteira

No `AppLayout.tsx`, mover o item "Cadastros" do grupo "Avancado" para o array `preContactItems`, logo apos "Carteira". Assim ele aparece diretamente no menu lateral, nao escondido dentro do collapsible.

## 2. Tipos pre-definidos (Devedor e Divida)

Adicionar seed de dados pre-definidos diretamente na UI dos componentes `TipoDevedorList` e `TipoDividaList`. Quando a lista estiver vazia, oferecer um botao "Carregar tipos padrao" que insere automaticamente:

**Tipos de Devedor:** Casual, Recorrente, Perda de Emprego, Aposentado, Estudante, Empresarial

**Tipos de Divida:** Boleto, Cartao de Credito, Promissoria, Cheque, Financiamento, Emprestimo, Mensalidade

## 3. Credor - Template de documentos com modo edicao protegido

Na aba "Negociacao" do `CredorForm.tsx`, os textareas de template atualmente sao editaveis livremente (basta clicar e digitar). A mudanca sera:

- Os textareas ficarao **desabilitados por padrao** (read-only, com fundo cinza)
- Ao lado do botao "Inserir Variavel", adicionar um botao "Editar" (icone de lapis)
- Ao clicar em "Editar", o textarea fica habilitado para edicao
- Ao clicar novamente (agora "Salvar"), volta ao modo read-only
- Isso garante que o template fique "fixo" e so seja editado intencionalmente

## 4. Carteira - Reorganizar dropdown dos 3 pontinhos

No `CarteiraPage.tsx`, mover "Exportar Excel" para dentro do dropdown `MoreVertical` e reordenar:

1. Planilha Modelo
2. Importar Devedores
3. Exportar Devedores

Remover o botao "Exportar Excel" do componente `ClientFilters` (prop `onExportExcel`).

## 5. Carteira - Filtros avancados colapsaveis

Redesenhar o `ClientFilters.tsx` com dois niveis:

**Nivel visivel (sempre aparece):**

- Campo "Nome ou CPF" + Botao "Pesquisar"

**Nivel oculto (expande com setinha):**

- Tipo de Divida (dropdown, dados vem da tabela `tipos_divida`)
- Tipo de Devedor (dropdown, dados vem da tabela `tipos_devedor`)
- Data de Vencimento (De / Ate)
- Credor (dropdown, dados vem da tabela `credores`)
- Status (dropdown: Todos, Pendente, Pago, Quebrado)
- Sem Acordo (checkbox - filtra clientes que nunca tiveram acordo)

A setinha sera um botao com icone `ChevronDown`/`ChevronUp` que expande/recolhe os filtros avancados usando o componente `Collapsible`.

O filtro "Sem Acordo" cruzara dados com a tabela `agreements` para identificar clientes cujo CPF nunca apareceu em nenhum acordo.

---

## Detalhes Tecnicos

### Arquivos modificados:

`**src/components/AppLayout.tsx**`

- Mover `{ label: "Cadastros", icon: Database, path: "/cadastros" }` de `advancedNavItems` para `preContactItems` (apos Carteira)

`**src/components/cadastros/TipoDevedorList.tsx**`

- Adicionar botao "Carregar tipos padrao" quando lista vazia
- Inserir array de tipos pre-definidos via `upsertTipoDevedor`

`**src/components/cadastros/TipoDividaList.tsx**`

- Mesmo padrao acima com tipos de divida pre-definidos

`**src/components/cadastros/CredorForm.tsx**`

- Adicionar estado `editingTemplate` (objeto com 3 booleans: acordo, recibo, quitacao)
- Textareas com `disabled={!editingTemplate.acordo}` etc.
- Botao "Editar"/"Concluir" ao lado de "Inserir Variavel" para cada template

`**src/pages/CarteiraPage.tsx**`

- Mover `handleExportExcel` para dentro do DropdownMenu
- Reordenar itens: Planilha Modelo, Importar Devedores, Exportar Devedores
- Remover prop `onExportExcel` do `ClientFilters`
- Passar dados de credores, tipos_devedor e tipos_divida para `ClientFilters`
- Adicionar query para buscar `agreementCpfs` (ja existe) e nova logica de filtro "sem acordo"

`**src/components/clients/ClientFilters.tsx**`

- Redesenhar com layout colapsavel
- Nivel 1: campo busca + botao pesquisar
- Nivel 2 (oculto): grid de filtros avancados com setinha para expandir
- Novos props: `credores`, `tiposDevedor`, `tiposDivida`
- Novo filtro `semAcordo` (boolean)
- Usar `Collapsible` do Radix UI para o toggle

**Nota sobre filtros de tipo_devedor e tipo_divida na carteira:**
Como a tabela `clients` atualmente nao tem colunas `tipo_devedor_id` e `tipo_divida_id`, esses filtros ficarao preparados na interface mas so funcionarao plenamente apos vincular essas colunas aos clientes (previsto para campanhas futuras). Por ora, os dropdowns serao renderizados mas o filtro nao sera aplicado no backend ate que as colunas existam.

Alternativa: Criar uma migracao SQL adicionando `tipo_devedor_id` e `tipo_divida_id` (nullable, UUID, FK) a tabela `clients` para que os filtros ja funcionem. Essa e a abordagem recomendada.

### Migracao SQL (adicionar colunas a clients):

```sql
ALTER TABLE clients ADD COLUMN tipo_devedor_id uuid REFERENCES tipos_devedor(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN tipo_divida_id uuid REFERENCES tipos_divida(id) ON DELETE SET NULL;
```

Isso permitira que ao importar ou cadastrar um cliente, ele possa ser classificado por tipo de devedor e tipo de divida, e os filtros da carteira funcionarao imediatamente.   
  
O opção /assinatura deve ser incluida dentro de cadastros/Devedor como uma aba.   
Assim o administrador pode vincular um tipo de assinatura ao credor.   
  
Ele pode escolher se quer deixar essa função de assinatura ativa ou nao, dentro do credor.  