## Objetivos do usuário

1. **Editor abre cortado/encostado na lateral** — atualmente o Sheet entra pela direita (`side="right"`, `sm:max-w-2xl`), o que corta o A4. Mudar para um **Dialog centralizado, largo (max-w-5xl) e com altura controlada**, sem corte e com a folha visível por inteiro.
2. **Conteúdo inicial (formatação, variáveis) está empurrando o editor para baixo** — reorganizar em **layout de duas colunas**: à esquerda variáveis/formatação compactas, à direita a folha A4 (editor visual). Assim o editor aparece imediatamente sem rolar.
3. **Adicionar campo "Logo do documento"** no formulário do credor, na aba **Dados → abaixo de Endereço**, separado do logo do Portal. Esse logo é o usado no cabeçalho de TODOS os documentos.
4. **Layout fixo do documento (padronizar todos)**: 
   - Cabeçalho: logo do credor à esquerda (~20mm de largura), título do documento centralizado (puxado dinamicamente — "Carta de Acordo", "Recibo de Pagamento", etc.).
   - Linha horizontal de fora a fora abaixo do cabeçalho.
   - Corpo (única parte editável).
   - Linha horizontal de fora a fora acima do rodapé.
   - Rodapé: nome do credor + CNPJ + endereço completo (centralizado).
   - Quando o credor não tiver logo, **não exibir nada** (sem fallback de texto).

---

## Implementação

### 1. Novo campo `document_logo_url` na tabela `credores`

Migration adicionando a coluna (nullable, text). É independente do `portal_logo_url` (que continua sendo usado pelo portal de auto-atendimento).

```sql
ALTER TABLE public.credores ADD COLUMN document_logo_url text;
```

### 2. `src/components/cadastros/CredorForm.tsx` — aba Dados

Logo abaixo do `Collapsible` de Endereço (linha 365), inserir um novo bloco **"Logo dos Documentos"**:

- Preview quadrado 80×80, mesmo padrão visual do logo do portal.
- Botão "Upload" usando o mesmo bucket `avatars`, prefixo `credor-doc-logos/{credorId}/...`.
- Input opcional para colar URL.
- Texto auxiliar: *"Aparece no canto superior esquerdo de todos os documentos (~20mm). Recomendado: PNG transparente."*
- Botão "Remover" quando houver valor.

Reaproveita o `logoInputRef` pattern já usado para o portal (cria um segundo `useRef` para este input).

### 3. `src/services/documentLayoutService.ts` — fonte única do layout

Ajustes no `wrapDocumentInA4Page`:

- Header **redesenhado**: logo à esquerda com **largura fixa de 20mm** (`width:20mm; max-width:20mm; height:auto; object-fit:contain`), e o **título do documento centralizado na linha do cabeçalho** (não mais embaixo). Usar grid de 3 colunas: `[20mm | 1fr | 20mm]` para manter o título perfeitamente centralizado mesmo sem logo.
- Quando não houver logo, a coluna esquerda fica vazia (sem texto-fallback do nome do credor — atender requisito "quando não tiver logo, não colocar nada").
- Abaixo do header, **linha horizontal de fora a fora** (`<hr>` com margin-left/right negativo igual ao padding lateral, ou um `border-bottom` na div do header com largura 100%).
- Acima do rodapé, mantém a linha (já existe `border-top`) — apenas garantir que vá de borda a borda do conteúdo.
- Rodapé: continua com as duas linhas centralizadas (`line1: Razão Social — CNPJ`, `line2: Endereço completo`) implementadas no passo anterior.
- `CredorLayoutInfo` ganha o campo opcional `document_logo_url`. A prioridade do header é `document_logo_url ?? null` (não cai mais para `portal_logo_url`, que é específico do portal).

```ts
const headerLeft = documentLogoUrl
  ? `<img src="..." style="width:20mm;max-width:20mm;height:auto;object-fit:contain" />`
  : ''; // vazio quando não há logo

// Header em 3 colunas para centralizar o título de fato:
<header style="display:grid;grid-template-columns:20mm 1fr 20mm;align-items:center;gap:8mm;padding-bottom:6mm;border-bottom:1px solid #1a1a1a;">
  <div>${headerLeft}</div>
  <h1 style="text-align:center;font-size:16pt;...">${title}</h1>
  <div></div>
</header>
```

A barra decorativa atual (60px abaixo do título) é removida — substituída pela linha de fora a fora.

### 4. `src/services/documentDataResolver.ts` e demais consumidores

Passar `document_logo_url` no objeto `credor` para o wrapper. Verificar que `ClientDocuments.tsx`, `DocumentPreviewDialog.tsx` e `documentPdfService` passam o campo (ou apenas o objeto credor inteiro do banco).

### 5. `src/components/cadastros/CredorDocumentTemplates.tsx` — abrir centralizado

Trocar `Sheet` por `Dialog` com `DialogContent` largo:

- `className="max-w-5xl w-[95vw] max-h-[92vh] overflow-hidden p-0"` para garantir centralização e altura controlada.
- Layout interno em **duas colunas** (grid `lg:grid-cols-[280px_1fr]`):
  - **Coluna esquerda** (compacta, scroll próprio): título/descrição, guia de formatação compactada em 1 linha, lista de variáveis em accordion (igual hoje, mas mais densa).
  - **Coluna direita** (a folha A4 + toolbar do editor + botões Aplicar/Cancelar fixos no rodapé do dialog).
- O A4LiveEditor passa a receber `document_logo_url` no objeto `credor`.

### 6. `src/components/cadastros/A4LiveEditor.tsx` — ajuste de tamanho

- Remover/reduzir o `transform: scale(0.85)` e usar `zoom` adaptativo ou simplesmente deixar o A4 em escala natural com scroll vertical. Dado que o Dialog passa a ter `max-w-5xl`, o A4 (210mm ≈ 794px) cabe à direita.
- Wrapper ganha `max-h: calc(92vh - 180px)` com `overflow-y-auto`, garantindo que a folha role internamente sem cortar o Dialog.

### 7. Sample data

Atualizar `SAMPLE_CREDOR` em `documentLayoutService.ts` adicionando `document_logo_url: ""` para preview consistente.

---

## Resumo dos arquivos

- **DB migration**: `ALTER TABLE credores ADD COLUMN document_logo_url text`.
- **`src/components/cadastros/CredorForm.tsx`**: novo bloco de upload "Logo dos Documentos" abaixo do Endereço.
- **`src/services/documentLayoutService.ts`**: header em grid 3 colunas, logo 20mm, título centralizado na linha do header, linha horizontal full-width, sem fallback textual quando não há logo, novo campo `document_logo_url`.
- **`src/components/cadastros/CredorDocumentTemplates.tsx`**: trocar Sheet por Dialog centralizado e adotar layout 2 colunas.
- **`src/components/cadastros/A4LiveEditor.tsx`**: ajustar dimensões/scroll para caber no novo Dialog; passar `document_logo_url`.
- **`src/services/documentDataResolver.ts`** e callers (`ClientDocuments.tsx`, `DocumentPreviewDialog.tsx`): incluir `document_logo_url` ao montar o objeto do credor.

## Fora de escopo
- Não altera a renderização do PDF além do que vem do wrapper (continua single source of truth).
- Não migra logos antigos do portal para o novo campo — o admin sobe a logo nova quando quiser usar nos documentos.
