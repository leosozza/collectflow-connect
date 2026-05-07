# Corrigir download do Recibo (Bloco de Notas → PDF formatado)

## Diagnóstico

Os "Modelos de Documentos" do credor (Acordo, Recibo, Quitação, etc.) já têm um pipeline correto de PDF em `src/components/client-detail/ClientDocuments.tsx`:

1. Resolve o template (credor → tenant → padrão) em `resolveTemplate`
2. Renderiza placeholders via `renderDocument`
3. Empacota em folha A4 com cabeçalho/rodapé via `wrapDocumentInA4Page`
4. Gera PDF via `downloadPdf` (html2pdf.js)

**O problema** está em outro lugar: o botão "Baixar Recibo" das parcelas pagas, em `src/components/client-detail/AgreementInstallments.tsx` (linha 342 — `handleDownloadReceipt`), ignora completamente esse pipeline e gera um `Blob` `text/plain` com sufixo `.txt`:

```ts
const blob = new Blob([receiptContent], { type: "text/plain;charset=utf-8" });
a.download = `recibo_parcela_${inst.displayNumber}_${cpf}.txt`;
```

É exatamente esse "bloco de notas" que o usuário está vendo. Os outros documentos (Acordo, Quitação, Descrição de Dívida, Notificação) já são gerados em PDF corretamente.

## Mudança proposta

### Arquivo único: `src/components/client-detail/AgreementInstallments.tsx`

Reescrever `handleDownloadReceipt(inst)` para reutilizar o mesmo pipeline de `ClientDocuments`:

1. Buscar (via `useQuery` no topo do componente) os dados do credor com os campos de template e endereço — mesmo `select` usado em `ClientDocuments.tsx` (`razao_social, nome_fantasia, cnpj, portal_logo_url, document_logo_url, endereco, numero, complemento, bairro, cidade, uf, cep, email, template_recibo`) filtrando por `client.credor`.
2. Buscar fallback de templates do tenant (`document_templates` onde `type = 'recibo'`).
3. No handler:
   - Resolver template: credor → tenant → `TEMPLATE_DEFAULTS.template_recibo`.
   - Montar `vars` da parcela específica (sobrescrevendo os globais quando fizer sentido):
     - `{numero_parcela}` = `inst.displayNumber`
     - `{total_parcelas}` = `totalInstallments`
     - `{valor_parcela}` = `formatCurrency(inst.value)`
     - `{valor_pago}` = `formatCurrency(inst.value)`
     - `{data_vencimento}` = `formatDate(inst.dueDate)`
     - `{data_pagamento}` = data confirmada da `manualPayments` correspondente, ou `new Date()` como fallback
     - `{nome_devedor}`, `{cpf_devedor}`, `{credor}` a partir de `agreement`/`cpf`
   - Chamar `renderDocument(template, vars, source)`.
   - Empacotar com `wrapDocumentInA4Page({ bodyHtml, title: "Recibo de Pagamento", credor })`.
   - Chamar `downloadPdf(wrappedHtml, recibo_parcela_${n}_${cpf}_${data}.pdf)`.
4. Registrar evento `document_generated` em `client_events` (opcional, para manter paridade com `ClientDocuments`).

Remover a geração `text/plain` antiga.

## Detalhes técnicos

- Imports a adicionar em `AgreementInstallments.tsx`:
  ```ts
  import { TEMPLATE_DEFAULTS } from "@/lib/documentDefaults";
  import { renderDocument } from "@/services/documentRenderer";
  import { downloadPdf } from "@/services/documentPdfService";
  import { wrapDocumentInA4Page } from "@/services/documentLayoutService";
  ```
- Não há mudança de schema, RLS, edge function nem de outros componentes.
- O componente `ClientDocuments` continua intocado — já funciona.
- O resto dos botões/fluxos da tela permanecem iguais.

## Resultado esperado

Ao clicar em "Baixar Recibo" em uma parcela paga, o usuário recebe um PDF A4 com cabeçalho (logo + título), corpo renderizado a partir do `template_recibo` do credor (ou herdado do tenant/padrão) e rodapé com dados do credor — idêntico ao padrão visual dos demais documentos.
