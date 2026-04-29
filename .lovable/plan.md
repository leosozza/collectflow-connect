## Modelo de Documento A4 com Cabeçalho e Rodapé Profissional

### Objetivo
Transformar o documento padrão (hoje só corpo de texto solto) em uma folha **A4 estruturada**: logo do credor no canto superior esquerdo, **título centralizado no topo**, corpo limpo e organizado, e no rodapé centralizado o **endereço completo do credor**. Isso vale para preview na tela e para o PDF gerado.

### Arquitetura — onde plugar

O fluxo já existe e está bem dividido — vamos preservar tudo:
1. `resolveDocumentData()` → resolve placeholders do corpo
2. `renderDocument()` → aplica os placeholders + converte markdown
3. `DocumentPreviewDialog` → mostra preview A4
4. `documentPdfService.downloadPdf()` → gera PDF

A estratégia é **introduzir um wrapper "página A4" único** que envolve o HTML do corpo com cabeçalho e rodapé. Esse wrapper é usado nos dois pontos (preview e PDF) — fonte única de verdade, sem duplicação.

### Mudanças

#### 1. Trazer dados do credor para o renderer
- `ClientDocuments.tsx`: expandir o `select` da query do credor para incluir `portal_logo_url, endereco, numero, complemento, bairro, cidade, uf, cep, email`.
- Adicionar novos placeholders (opcionais, para quem quiser usar no corpo do template):
  - `{logo_credor}`, `{endereco_completo_credor}`, `{cidade_credor}`, `{uf_credor}`, `{cep_credor}`, `{email_credor}`, `{telefone_credor}`
- Atualizar `documentPlaceholders.ts` (lista oficial + amostras) e `documentDataResolver.ts` (resolver real).

#### 2. Criar `documentLayoutService.ts` — o wrapper A4
Arquivo novo, exporta `wrapDocumentInA4Page({ bodyHtml, title, credor })`. Retorna HTML completo de uma folha A4 com:

```text
┌─────────────────────────────────────────┐
│ [LOGO]                                  │  ← topo, alinhado à esquerda, h ~70px
│                                         │
│         TÍTULO DO DOCUMENTO             │  ← centralizado, 18pt, bold, com filete fino abaixo
│                                         │
│  Corpo do documento (markdown render).. │  ← serif, 11.5pt, line-height 1.65, justificado
│  .......................................│
│  .......................................│
│                                         │
│ ─────────────────────────────────────── │  ← filete superior do rodapé
│   Razão Social — Rua, nº — Bairro,      │  ← rodapé, centralizado, 9pt, cor cinza
│   Cidade/UF — CEP — CNPJ                │
└─────────────────────────────────────────┘
```

Detalhes:
- **Header**: flex com logo à esquerda (max 60×60mm, `object-fit: contain`); se não houver logo, mostra a razão social em pequeno como fallback.
- **Título**: extraído do `label` do tipo de documento (Acordo, Recibo, etc.) — centralizado, fonte serif, peso 700, com filete sutil abaixo.
- **Corpo**: o HTML que já vinha de `renderDocument`. Se o template do usuário começar com um `## Título` igual ao `label`, removemos para não duplicar.
- **Rodapé**: linha única centralizada, monta endereço a partir dos campos do credor (filtra vazios e une com " — "); inclui CNPJ no fim.
- Estilo Georgia/Times New Roman 11.5pt, cores neutras (`#1a1a1a` no corpo, `#666` no rodapé), filetes em `#d4d4d4`.
- Margens internas: 25mm topo, 20mm laterais, 22mm rodapé.

#### 3. Integrar nos dois pontos de uso
- **Preview (`DocumentPreviewDialog`)**: trocar o `dangerouslySetInnerHTML` direto pelo HTML envelopado. Manter o aspect-ratio A4 e o scroll do dialog.
- **PDF (`documentPdfService.downloadPdf`)**: aceitar `wrappedHtml` já pronto; ajustar `html2pdf` para `margin: 0` (as margens agora são do próprio layout) e manter A4 retrato.
- **`ClientDocuments.handleGenerate`**: passar `credor` + `label` para o wrapper antes de setar o preview.

#### 4. Atualizar templates default (`documentDefaults.ts`)
Reescrever os 5 defaults removendo os títulos repetidos no início (já vão pro cabeçalho) e ajustando para markdown limpo:
- Tipografia hierárquica com `##` apenas para subtítulos internos (ex: "Cláusula Primeira"), parágrafos justificados, listas com `-`, separadores `---` para áreas de assinatura.
- Inclui `{tabela_parcelas}` no template de **Acordo** (já que existe o componente).
- Inclui blocos de assinatura padronizados (linha + nome).

#### 5. Polir o preview do editor (`CredorDocumentTemplates.tsx` — tela da imagem)
A pré-visualização dentro do editor (aba **Preview**) também usa o mesmo wrapper, para o usuário ver exatamente como ficará a folha final. O `EditorPreview` passa a chamar `wrapDocumentInA4Page` com dados fictícios (`SAMPLE_DATA` + um credor mock).

### Arquivos afetados
- **Novos**: `src/services/documentLayoutService.ts`
- **Editados**:
  - `src/services/documentDataResolver.ts` (novos placeholders + tipo do input)
  - `src/lib/documentPlaceholders.ts` (lista + amostras)
  - `src/lib/documentDefaults.ts` (templates reescritos, sem repetir título)
  - `src/services/documentPdfService.ts` (margens 0, recebe HTML já envelopado)
  - `src/components/client-detail/ClientDocuments.tsx` (select expandido + envelope no handleGenerate)
  - `src/components/client-detail/DocumentPreviewDialog.tsx` (renderiza HTML envelopado)
  - `src/components/cadastros/CredorDocumentTemplates.tsx` (preview com wrapper)

### Compatibilidade
- Templates já customizados pelo credor **continuam funcionando** — o corpo deles vai pro miolo da folha, ganhando cabeçalho e rodapé "de graça".
- Se o credor não tiver logo cadastrado: o cabeçalho exibe só o título centralizado (sem espaço fantasma).
- Se faltar parte do endereço: o rodapé monta com o que existir, sem mostrar separadores soltos.

### Não faremos agora
- Múltiplas páginas com numeração (1/2, 2/2) — o html2pdf já paginar automaticamente; numeração explícita exige outra biblioteca.
- Marca d'água ou QR Code de validação.
- Editor visual WYSIWYG (continua sendo markdown leve, como hoje).

Posso aplicar?