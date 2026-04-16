---
name: Papéis do Sistema em tipos_status
description: tipos_status.regras.papel_sistema desacopla nome visual do comportamento na automação multi-tenant
type: feature
---

A tabela `tipos_status` usa o campo JSONB `regras.papel_sistema` como chave semântica fixa para identificar o papel do status na automação. Isso permite que cada tenant renomeie status livremente sem quebrar a automação.

**Papéis fixos (7):**
`em_dia` | `inadimplente` | `acordo_vigente` | `acordo_atrasado` | `quebra_acordo` | `quitado` | `em_negociacao`

**Pontos de lookup (todos com fallback por nome):**
- `supabase/functions/auto-status-sync/index.ts` — usa `resolveId(papel, fallbackNome)` via `statusByPapel` e `statusByName`
- `supabase/functions/maxlist-import/index.ts` — busca `regras.papel_sistema = 'inadimplente'` com fallback para nome 'vencido' ou 'inadimplente'
- `src/services/agreementService.ts` — 3 queries (createAgreement, cancelAgreement, reopenAgreement) usam `.or('regras->>papel_sistema.eq.X,nome.eq.Y')` filtrando depois pelo papel correto

**UI (`src/components/cadastros/TipoStatusList.tsx`):**
- Select "Papel no Sistema" com 7 opções + "Nenhum (custom)"
- Validação de unicidade: cada papel só pode ser atribuído a 1 status por tenant
- Botão de excluir desabilitado para status com papel definido (proteção anti-quebra)
- Botão "Carregar status padrão" cria os 7 com papel_sistema preenchido, pulando papéis já existentes

**Status sem papel_sistema** = custom/visual, sem impacto na automação.

**Backfill aplicado**: Status existentes com nomes canônicos (case-insensitive) tiveram papel_sistema preenchido automaticamente.
