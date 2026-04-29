
# Editor de modelos de documento — WYSIWYG com layout A4 ao vivo

## Objetivos
1. Eliminar o modo "bloco de notas" (textarea monoespaçada) e o uso obrigatório da aba **Preview**. O editor já mostra a folha A4 com título centralizado e rodapé como ficará no PDF final.
2. Reorganizar o rodapé: 1ª linha **Razão Social — CNPJ 00.000.000/0000-00** (centralizada); 2ª linha endereço completo (Rua, nº, complemento — Bairro — Cidade/UF — CEP), também centralizado.

## O que muda na UI

### Antes
- Sheet com abas **Editor / Preview**.
- Editor: `Textarea` font-mono, sem qualquer formatação visual, sem header/título nem rodapé.
- Para ver o resultado o usuário precisa clicar em "Preview".
- Rodapé renderizado em uma única linha juntando tudo com " — ", ordem: Credor, Endereço, Bairro, Cidade/UF, CEP, CNPJ.

### Depois
- **Aba única** dentro do Sheet (abas Editor/Preview removidas).
- O editor passa a ser um **`contentEditable` estilizado como folha A4**, dentro de um wrapper que reproduz o `wrapDocumentInA4Page`:
  - Cabeçalho com logo do credor (canto superior esquerdo).
  - **Título do documento centralizado** (ex.: "CARTA DE QUITAÇÃO") com a barra decorativa — não editável, atualizado automaticamente conforme o documento.
  - Corpo editável com tipografia Georgia/Times 11.5pt, justificado, espaçamento de Word.
  - Rodapé fixo (não editável) na nova ordem.
- Tokens de variável (ex.: `{nome_devedor}`) aparecem destacados como "chips" coloridos dentro do texto editável (badge sutil, fundo accent), preservando a edição livre ao redor.
- Atalhos básicos do editor: **Ctrl/⌘+B** negrito, **Ctrl/⌘+I** itálico, **Enter** novo parágrafo, **Shift+Enter** quebra de linha. Atalhos opcionais via barra de ferramentas mínima (Negrito · Itálico · Título · Lista · Separador) acima da folha.
- Clicar em uma variável da lista lateral continua **copiando para o clipboard** (comportamento atual). Adicionalmente, se o cursor estiver dentro do editor, é inserida no ponto do cursor (mantendo retro-compatibilidade do fluxo).

### Rodapé reorganizado (duas linhas)
Linha 1 (centralizada, semibold):
```
{Razão Social} — CNPJ 12.345.678/0001-90
```
Linha 2 (centralizada, normal):
```
Av. Paulista, 1000 - Sala 1201 — Bela Vista — São Paulo/SP — CEP 01310-100
```
Se algum campo estiver vazio, ele é omitido sem deixar separador órfão.

## Arquivos afetados

1. **`src/services/documentLayoutService.ts`**
   - `buildFooterText` deixa de retornar uma única string e passa a retornar `{ line1, line2 }`.
   - Em `wrapDocumentInA4Page`, o `<footer>` é renderizado com duas `<div>` empilhadas, ambas `text-align:center`, line1 com `font-weight:600;color:#333`, line2 com `color:#666`.
   - Mesma função continua sendo a fonte única de verdade, então PDF final, preview do `ClientDocuments` e o novo editor herdam o layout idêntico.

2. **`src/components/cadastros/CredorDocumentTemplates.tsx`**
   - Remover `Tabs/TabsList/TabsTrigger/TabsContent` e o estado `editorTab`.
   - Substituir o `Textarea` por um novo componente `A4LiveEditor` (definido no mesmo arquivo ou em `src/components/cadastros/A4LiveEditor.tsx`):
     - Renderiza o resultado de `wrapDocumentInA4Page` em volta de um `<div contentEditable>` que ocupa o lugar do `<main>`.
     - `onInput` lê `innerHTML` da área editável → converte de volta para o formato markdown-leve usado hoje (negrito `**`, itálico `*`, headings `##/###`, listas `-`, separador `---`) via util novo `htmlToMarkdownLight` (espelho de `markdownLight`). Atualiza `editContent` no estado pai.
     - Variáveis `{xxx}` são "tokenizadas" no momento do render: regex envolve cada match com `<span class="rivo-var-chip" data-var="{xxx}">{xxx}</span>` (style: bg accent/15, border accent/30, padding 0 4px, rounded). No save, esses chips voltam a ser texto puro `{xxx}`.
   - Barra de ferramentas mínima acima da folha (5 botões: B, I, H2, lista, hr) usando `document.execCommand` ou `Selection` API para inserir o markdown correspondente.
   - Pequena legenda inferior: "Substituições e variáveis aparecem como dados de exemplo no rodapé/preview real do PDF."

3. **`src/lib/markdownLight.ts`** (somente verificação — não altera saída).
   - Adiciona, ao lado do `markdownToHtml` existente, um `htmlToMarkdownLight(html)` que faz a conversão inversa:
     - `<strong>`/`<b>` → `**...**`
     - `<em>`/`<i>` → `*...*`
     - `<h2>` → `## ...`, `<h3>` → `### ...`
     - `<ul><li>` → `- item`
     - `<hr>` → `---`
     - `<p>` → linha em branco entre blocos.
   - Strip de outras tags HTML residuais para manter o conteúdo salvo igual ao formato atual (o backend e o `markdownToHtml` continuam funcionando sem mudanças).

4. **`EditorPreview`** dentro de `CredorDocumentTemplates.tsx`
   - Passa a ser usado **apenas** como base do novo editor ao vivo (não há mais aba Preview separada). A função `replaceVars(content, SAMPLE_DATA)` continua sendo usada para os "chips" de variável e para a renderização do rodapé com dados do credor real / SAMPLE_CREDOR.

## Detalhes técnicos

### Sincronização texto ↔ HTML editável
```text
state.editContent (markdown leve, com {vars})
        │  markdownToHtml + tokenizeVars
        ▼
contentEditable.innerHTML  ← exibido em A4
        │  htmlToMarkdownLight + untokenizeVars
        ▼
state.editContent (atualizado em onInput)
```
Para evitar o problema clássico de cursor "pular" no contentEditable, usamos um padrão "uncontrolled":
- Setamos `innerHTML` apenas quando `editingKey` muda (abertura do sheet) ou ao inserir uma variável programaticamente.
- O `onInput` atualiza apenas o estado em `editContent`, mas **não** reescreve o `innerHTML` enquanto o usuário digita.

### Rodapé responsivo
```ts
function buildFooter(credor) {
  const name = credor.razao_social || credor.nome_fantasia;
  const cnpj = credor.cnpj ? `CNPJ ${formatCnpj(credor.cnpj)}` : '';
  const line1 = [name, cnpj].filter(Boolean).join(' — ');

  const street = [credor.endereco, credor.numero].filter(Boolean).join(', ');
  const streetWithComp = credor.complemento ? `${street} - ${credor.complemento}` : street;
  const cityState = [credor.cidade, credor.uf].filter(Boolean).join('/');
  const cep = formatCep(credor.cep);
  const line2 = [streetWithComp, credor.bairro, cityState, cep && `CEP ${cep}`]
    .filter(Boolean).join(' — ');

  return { line1, line2 };
}
```

### Aspectos preservados
- Validação de variáveis desconhecidas (`validatePlaceholders`) e o diálogo de confirmação continuam idênticos.
- Salvar segue gravando no mesmo campo do form (markdown leve), portanto **PDF, preview do `ClientDocuments` e templates já existentes não quebram**.
- Botão "Aplicar/Cancelar" e fluxo de Sheet permanecem.

## Fora de escopo
- Não migra para um editor rich-text completo (Tiptap/Slate). A edição continua restrita ao subset markdown que o sistema já renderiza, evitando divergência entre o que aparece no editor e o PDF final.
- Não muda a tipografia/estilos do PDF além das duas linhas do rodapé.
