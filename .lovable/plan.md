

# Plano: Fase 3 — Evolução do Editor e Preview

## Escopo

Evoluir `DocumentTemplatesPage.tsx` sem trocar textarea, sem bibliotecas pesadas, sem alterar `ClientDocuments.tsx`.

## Alterações

### 1. Novo utilitário: `src/lib/markdownLight.ts`

Parser simples de markdown leve para HTML:
- `**texto**` → `<strong>`
- `*texto*` → `<em>`
- `## Título` → `<h2>`
- `### Subtítulo` → `<h3>`
- `- item` → `<ul><li>`
- `---` → `<hr>`
- Linhas vazias → separação de parágrafos (`<p>`)
- Placeholders `{variavel}` destacados com `<span>` colorido no preview

Função pura, ~50 linhas, sem dependências.

### 2. Evoluir `DocumentTemplatesPage.tsx`

**Editor (Sheet lateral):**
- Adicionar guia visual de formatação acima do textarea: "Formatação: **negrito**, *itálico*, ## título, - lista, --- separador"
- Aumentar textarea para `min-h-[450px]`
- Adicionar tooltips nos botões de placeholder (já existe `title`, migrar para `Tooltip` component)
- Placeholders agrupados por categoria com ícones (já implementado, melhorar visual com accordion colapsável)

**Preview (Dialog):**
- Substituir o `<div>` simples por layout estilo folha A4:
  - Container com `max-w-[210mm]`, `min-h-[297mm]`, `bg-white`, `shadow-lg`, padding de margens reais (~25mm)
  - Tipografia serifada (`font-serif`), `leading-relaxed`, tamanho adequado
- Renderizar conteúdo usando `markdownLight` → HTML via `dangerouslySetInnerHTML`
- Preview em tempo real no editor: adicionar aba "Preview" dentro do Sheet que mostra o resultado formatado ao lado/abaixo do textarea

**Preview no editor (layout responsivo):**
- No Sheet, adicionar toggle "Editor / Preview" para alternar entre textarea e preview formatado
- Preview usa o mesmo parser + `SAMPLE_DATA` para substituir variáveis

### 3. Nenhuma alteração em outros arquivos

- `ClientDocuments.tsx` — intocado
- `documentPlaceholders.ts` — intocado
- `documentDefaults.ts` — intocado
- Lógica de geração — intocada

## Arquivos

| Arquivo | Tipo |
|---|---|
| `src/lib/markdownLight.ts` | Novo — parser simples |
| `src/pages/DocumentTemplatesPage.tsx` | Evoluir editor e preview |

