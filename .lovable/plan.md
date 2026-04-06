

# Plano: Fase 4 — Componentes Dinâmicos e Regras de Geração

## Resumo

Criar camada de serviços para resolução de dados, validação por regras de negócio e renderização inteligente. Integrar na aba Documentos do cliente sem redesenhar a UI. Adicionar suporte a `{tabela_parcelas}`.

## Arquivos novos

| Arquivo | Responsabilidade |
|---|---|
| `src/services/documentDataResolver.ts` | Monta payload de dados reais a partir de client, credor, acordo e títulos. Retorna `Record<string, string>` com todas as variáveis + gera HTML da tabela de parcelas para `{tabela_parcelas}` |
| `src/services/documentRenderer.ts` | Recebe template + payload → substitui placeholders simples e compostos → retorna `{ text, html, templateSource, missingPlaceholders[] }` |
| `src/services/documentValidationService.ts` | Valida se documento pode ser gerado por tipo: acordo (requer acordo vigente), recibo (requer pagamento), quitação (requer saldo zero), divida/notificacao (requer débito ativo). Retorna `{ isValid, reason, missingFields, status }` |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/documentPlaceholders.ts` | Adicionar `{tabela_parcelas}` na lista + sample data com tabela HTML de exemplo |
| `src/lib/markdownLight.ts` | Não alterar — tabela de parcelas já será injetada como HTML pelo resolver |
| `src/components/client-detail/ClientDocuments.tsx` | Integrar os 3 serviços: (1) validar antes de gerar, (2) resolver dados com `documentDataResolver`, (3) renderizar com `documentRenderer`. Exibir status por documento (disponível / indisponível com motivo). Manter layout existente, apenas evoluir feedback visual nos botões |
| `src/pages/DocumentTemplatesPage.tsx` | Atualizar `SAMPLE_DATA` usage para incluir `{tabela_parcelas}` no preview com dados fictícios |

## Detalhes técnicos

### documentDataResolver.ts

```typescript
export interface DocumentData {
  vars: Record<string, string>;
  raw: { client, credor, agreement, titles };
}

export function resolveDocumentData(params): DocumentData {
  // Monta todas as variáveis existentes (mesmo que ClientDocuments já faz)
  // Gera {tabela_parcelas} como HTML table a partir do acordo
  // Usa getEffectiveAgreementSummary para valores reais das parcelas
}
```

A tabela de parcelas será gerada como HTML simples (`<table>` com colunas Parcela / Vencimento / Valor) quando houver acordo, ou string vazia quando não houver.

### documentValidationService.ts

```typescript
export interface ValidationResult {
  isValid: boolean;
  reason: string;
  status: "available" | "unavailable" | "missing_data";
}

export function validateDocumentGeneration(
  docType: string, 
  agreement: any | null, 
  titles: any[], 
  totalAberto: number, 
  totalPago: number
): ValidationResult
```

Regras:
- `acordo`: requer `agreement` com status vigente
- `recibo`: requer `totalPago > 0`
- `quitacao`: requer `totalAberto <= 0` ou acordo com status pago
- `divida`, `notificacao`: requer `totalAberto > 0`

### documentRenderer.ts

```typescript
export interface RenderResult {
  text: string;
  html: string;
  templateSource: "credor" | "tenant" | "default";
  missingPlaceholders: string[];
}

export function renderDocument(template: string, vars: Record<string, string>, source: string): RenderResult
```

Substitui `{variavel}` pelo valor; identifica placeholders sem valor; usa `markdownToHtml` para gerar HTML.

### ClientDocuments.tsx — Evolução

Cada botão de documento passará a exibir:
- Estado visual: ícone verde (disponível), amarelo (dados faltando), vermelho (indisponível por regra)
- Tooltip/subtítulo com motivo: "Sem acordo disponível", "Pagamento não encontrado", etc.
- Botão continua clicável quando `isValid`, mostra toast de erro quando não

O `templateVars` atual será substituído pelo resultado de `resolveDocumentData`, centralizando a lógica.

### Compatibilidade preview (DocumentTemplatesPage)

O preview de modelos continuará usando `SAMPLE_DATA` com dado fictício para `{tabela_parcelas}` (tabela HTML de exemplo com 3 parcelas).

## Nenhuma alteração de banco

Não há migration nesta fase.

