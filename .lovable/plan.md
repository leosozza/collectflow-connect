

# Plano: Mover Modelos de Documentos para o Credor + Correções Funcionais

## Situação atual

- `DocumentTemplatesPage` (446 linhas) opera em `document_templates` (nível tenant) — acessível em Configurações
- `CredorForm.tsx` aba Personalização (linhas 570-652) tem editor básico (textarea + variáveis) que salva diretamente nas colunas `template_*` da tabela `credores`
- `ClientDocuments.tsx` já usa fallback correto: credor → tenant → default
- Existem dois editores diferentes para a mesma funcionalidade

## Alterações

### 1. Remover aba "Modelos de Documentos" de ConfiguracoesPage

- Remover import de `DocumentTemplatesPage`
- Remover item `documentos` do array `items`
- Remover bloco de renderização condicional `visited.has("documentos")`

### 2. Criar componente reutilizável `CredorDocumentTemplates`

Novo arquivo: `src/components/cadastros/CredorDocumentTemplates.tsx`

Componente que exibe os 5 tipos de documento no contexto do credor, com:

- **Status de origem por documento**: badge indicando "Modelo próprio do credor" / "Herdando do tenant" / "Usando padrão do sistema"
- **Edição**: ao clicar "Editar", abre Sheet lateral com o editor rico (mesmo estilo do `DocumentTemplatesPage` — markdown, placeholders categorizados, preview) — o conteúdo salva na coluna `template_*` correspondente do credor
- **Preview A4**: reutiliza o componente `A4Preview` já existente
- **Indicação visual clara** de quando o credor está sobrescrevendo vs herdando

Lógica de status por documento:
- Se `credor[template_key]` tem conteúdo → "Modelo próprio do credor"
- Senão, busca `document_templates` do tenant → "Herdando modelo do tenant"
- Senão → "Usando padrão do sistema"

Props: recebe `credorId`, `form` (estado do form), `set` (setter do form)

### 3. Substituir seção atual no CredorForm

Na aba Personalização do `CredorForm.tsx`, substituir o bloco "Modelos de Documentos" (linhas 570-652) pelo novo componente `<CredorDocumentTemplates>`.

Remove:
- Os dialogs inline de edição de template
- A lista simplificada de cards com botão "Editar"

### 4. Validação de placeholders ao salvar

No `CredorDocumentTemplates`, ao salvar modelo:
- Extrair todos os `{...}` do conteúdo
- Comparar com a lista oficial de `DOCUMENT_PLACEHOLDERS`
- Se houver placeholders inválidos → exibir aviso antes de salvar: "Este modelo contém variáveis inválidas: {xxxx}, {yyyy}"
- Permitir salvar com confirmação, mas alertar

### 5. Exibir origem do template no DocumentPreviewDialog

Adicionar prop `templateSource` ao `DocumentPreviewDialog`:
- Exibir badge discreto no header: "Modelo: Credor" / "Modelo: Tenant" / "Modelo: Padrão"
- Apenas informativo, sem alterar layout

### 6. Melhorar mensagens na aba Documentos do cliente (ClientDocuments)

Refinar as mensagens de `validation.reason` para ficarem mais operacionais:
- "Sem acordo vigente para gerar carta de acordo"
- "Nenhum pagamento confirmado para gerar recibo"
- "Quitação disponível apenas para débito liquidado"
- "Modelo não configurado para este credor"

Atualizar em `documentValidationService.ts`.

### 7. Registrar visualização na timeline

Em `ClientDocuments.tsx`, ao abrir preview (antes do download):
- Inserir evento `document_previewed` em `client_events`
- Manter o evento `document_generated` apenas no download do PDF

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/components/cadastros/CredorDocumentTemplates.tsx` | Novo — editor rico no contexto do credor |
| `src/components/cadastros/CredorForm.tsx` | Substituir seção de templates pelo novo componente |
| `src/pages/ConfiguracoesPage.tsx` | Remover aba e import de DocumentTemplatesPage |
| `src/components/client-detail/DocumentPreviewDialog.tsx` | Adicionar badge de origem |
| `src/components/client-detail/ClientDocuments.tsx` | Evento de preview + passar templateSource ao dialog |
| `src/services/documentValidationService.ts` | Melhorar mensagens |
| `src/pages/DocumentTemplatesPage.tsx` | Manter arquivo (usado internamente pelo novo componente como referência de estilo), mas sem rota direta |

## Sem alteração de banco

Não há migration. Os templates do credor continuam nas colunas existentes da tabela `credores`.

