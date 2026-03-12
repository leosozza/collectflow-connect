

# Plano: Logs detalhados, Excel, Auditoria, Filtro e Indicador Visual de Higienização

## 1. Migração SQL — Coluna `enrichment_data` na tabela `clients`

```sql
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT NULL;
```

Corrige o filtro "Higienizados" na Carteira que já verifica `enrichment_data IS NOT NULL`.

## 2. Refatorar `EnrichmentConfirmDialog.tsx`

Após higienização concluída, buscar `enrichment_logs` do job via Supabase e exibir:

- **Tabela detalhada** com ScrollArea: CPF | Status (badge verde/vermelho) | Telefones | Email encontrados
- **Botão "Copiar Log"** — copia texto formatado (CPF + status + dados) para clipboard
- **Botão "Exportar Excel"** — gera XLSX usando `xlsx` (já instalado) com os logs do job
- Manter cards de resumo (Total, Atualizados, Não encontrados)
- Dialog expandido para `sm:max-w-2xl`
- Chamar `logAction({ action: "enrichment", entity_type: "enrichment_job", entity_id: jobId, details: { cpfs: uniqueCpfs.length, enriched, failed, cost } })` após conclusão

## 3. Indicador visual 🧹 no `ClientDetailHeader.tsx`

Nas linhas 278-283 (seção Telefones/Email), para cada campo `phone2`, `phone3`, `email`:
- Se `client.enrichment_data != null`, exibir `🧹` ao lado do valor
- Envolver em `Tooltip` com texto "Dado obtido via higienização"
- Import `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` do projeto

## 4. Nova aba "Higienização" no `AuditoriaPage.tsx`

Adicionar `TabsTrigger value="higienizacao"` e componente `HigienizacaoTab`:
- Query `enrichment_jobs` filtrado por tenant, ordenado por `created_at desc`
- Tabela: Data | Total CPFs | Enriquecidos | Falhos | Custo | Status
- Cada linha com botão expand para mostrar `enrichment_logs` do job (CPF, status, dados)
- Botão Excel por job usando `exportToExcel` de `exportUtils`

## 5. Labels de auditoria

No `actionLabels` do `AuditoriaPage.tsx` (linha 28), adicionar:
```ts
enrichment: "Higienização",
```

No `entityLabels` (linha 38), adicionar:
```ts
enrichment_job: "Job de Higienização",
```

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova migração: coluna `enrichment_data` |
| `src/components/carteira/EnrichmentConfirmDialog.tsx` | Tabela de logs, copiar, exportar Excel, logAction |
| `src/components/client-detail/ClientDetailHeader.tsx` | Emoji 🧹 + tooltip nos campos higienizados |
| `src/pages/AuditoriaPage.tsx` | Nova aba Higienização + labels |

