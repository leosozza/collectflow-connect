

# Plano: Fase 5 — PDF Real, Histórico e Operação Completa

## Resumo

Adicionar geração de PDF via `html2pdf.js` (client-side), preview em modal, histórico de documentos gerados e registro na timeline do cliente. Sem alterar a lógica de renderização existente.

## Migration SQL

Criar tabela `client_generated_documents`:

```sql
CREATE TABLE public.client_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_cpf text NOT NULL,
  credor text,
  type text NOT NULL,
  template_source text NOT NULL, -- 'credor' | 'tenant' | 'default'
  template_snapshot text NOT NULL,
  rendered_html text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.client_generated_documents
  FOR SELECT TO authenticated USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant insert" ON public.client_generated_documents
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_my_tenant_id());
```

## Instalar dependência

`html2pdf.js` — converte HTML para PDF no browser usando html2canvas + jsPDF. Zero config, funciona client-side.

## Arquivos novos

| Arquivo | Responsabilidade |
|---|---|
| `src/services/documentPdfService.ts` | Recebe HTML renderizado, gera PDF A4 via `html2pdf.js`, retorna Blob. Função `generatePdf(html, filename)` para download e `generatePdfBlob(html)` para uso futuro (envio WhatsApp/email) |
| `src/components/client-detail/DocumentPreviewDialog.tsx` | Dialog com preview A4 do HTML renderizado + botões "Baixar PDF" e "Fechar". Reutiliza o estilo A4 já existente no `DocumentTemplatesPage` |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/ClientDocuments.tsx` | Cada botão de documento passa a abrir o `DocumentPreviewDialog` em vez de baixar `.txt`. O dialog mostra preview + botão PDF. Ao gerar, salva registro em `client_generated_documents` e insere evento em `client_events` |

## Detalhes técnicos

### documentPdfService.ts

```typescript
import html2pdf from 'html2pdf.js';

export async function generatePdfBlob(html: string): Promise<Blob> {
  // Wrap HTML in A4 container com tipografia serifada
  // Usar html2pdf com options: { margin: [25,20], filename, jsPDF: { format: 'a4' } }
}

export async function downloadPdf(html: string, filename: string): Promise<void> {
  // Chama html2pdf().save()
}
```

### ClientDocuments.tsx — Mudanças

1. Estado local: `previewDoc: { html, label, docType, templateSource, templateContent } | null`
2. `handleDownload` → renomear para `handleGenerate`: valida, resolve template, renderiza, abre dialog com HTML
3. No dialog: botão "Baixar PDF" chama `downloadPdf`, salva em `client_generated_documents`, registra evento em `client_events`
4. Nome do arquivo: `{tipo}_{nome_cliente}_{data}.pdf`

### Registro no histórico

Ao gerar PDF com sucesso:
- INSERT em `client_generated_documents` (snapshot do template + HTML renderizado + source)
- INSERT em `client_events` com `event_type: 'document_generated'`, metadata com tipo e template_source

### DocumentPreviewDialog.tsx

- Dialog fullscreen ou large
- Container A4 (mesmo CSS do DocumentTemplatesPage: `max-w-[210mm]`, `min-h-[297mm]`, `font-serif`, margens)
- `dangerouslySetInnerHTML` com o HTML já renderizado
- Botões: "Baixar PDF", "Fechar"

## Fluxo completo

```text
Operador clica documento → valida → resolve template → renderiza HTML
  → abre preview dialog
    → "Baixar PDF" → gera PDF via html2pdf.js → download
      → salva em client_generated_documents
      → registra client_event
```

## Sem alterações em

- `documentRenderer.ts` — intocado
- `documentDataResolver.ts` — intocado
- `documentValidationService.ts` — intocado
- `DocumentTemplatesPage.tsx` — intocado

