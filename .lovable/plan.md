

# Plano: Evolução Final do MaxList — Exclusivo YBRASIL

## Resumo

Transformar o MaxList em módulo exclusivo do tenant YBRASIL com dois fluxos distintos (Importar Carteira / Atualizar Parcelas), atualização inteligente com diff campo-a-campo, novo status `cancelado_maxlist`, relatório detalhado e restrição total de acesso. Sem alterar identidade visual, sem impactar outros tenants.

---

## Bloco 1: Restrição de Acesso — Somente YBRASIL

### 1.1 — Frontend (`MaxListPage.tsx`)
- Substituir `ALLOWED_SLUGS = ["maxfama", "temis", "ybrasil"]` por verificação via `tenant.settings.maxlist_enabled === true`
- Fallback: se settings não tiver a flag, checar `tenant.slug === "ybrasil"` como safety net
- Remover referências a `maxfama` e `temis`

### 1.2 — Edge function `maxlist-import`
- Após buscar `tenantData`, verificar `settings.maxlist_enabled === true`
- Se não habilitado: retornar erro 403 "MaxList não habilitado para este tenant"

### 1.3 — Edge function `maxsystem-proxy`
- Mesma validação: verificar `settings.maxlist_enabled` no tenant antes de prosseguir

### 1.4 — Menu lateral (`AppLayout.tsx`)
- Condicionar exibição do link MaxList à mesma flag `maxlist_enabled`

---

## Bloco 2: Dois Fluxos Distintos na UI

### 2.1 — Botões separados na tela MaxList

Após buscar dados (preview), exibir dois botões distintos em vez do botão único "Enviar todos para CRM":

- **Importar Carteira** — para primeira carga e novas parcelas. Usa mode `import`
- **Atualizar Parcelas** — para reconciliação. Usa mode `update`

### 2.2 — Textos descritivos
- Importar: "Insere novos registros no RiVO"
- Atualizar: "Sincroniza mudanças (pagamentos, cancelamentos, valores) com a base existente"

### 2.3 — Ambos chamam `maxlist-import` com novo campo `mode: "import" | "update"`

---

## Bloco 3: Edge Function `maxlist-import` — Atualização Inteligente

### 3.1 — Novo parâmetro `mode`
- `"import"` (default): comportamento atual — upsert direto
- `"update"`: reconciliação inteligente com diff

### 3.2 — Lógica do modo `update`

Para cada registro mapeado:
1. Buscar existente por `external_id + tenant_id`
2. Se não encontrado, fallback por `cod_contrato + numero_parcela + cpf + tenant_id`
3. Se não existe: inserir como novo
4. Se existe: comparar campos financeiros campo-a-campo

### 3.3 — Campos comparados no diff
```
data_pagamento, valor_pago, valor_parcela, valor_saldo,
data_vencimento, status, cod_contrato, numero_parcela, model_name
```

### 3.4 — Campos protegidos (NUNCA sobrescrever)
```
observacoes, propensity_score, debtor_profile, operator_id,
status_cobranca_id (exceto auto-sync), custom_data interno
```

### 3.5 — Regras de status YBRASIL
- Se `IsCancelled === true` na origem: `status = "cancelado_maxlist"`
- Se `PaymentDateEffected` preenchido: `status = "pago"`, atualizar `data_pagamento` e `valor_pago`
- Se em aberto: `status = "pendente"`

### 3.6 — Classificação de cada registro
- `novo`: não existia, foi inserido
- `atualizado`: existia, teve campos alterados (com diff detalhado)
- `pago`: subconjunto de atualizado — mudou para pago
- `cancelado_maxlist`: subconjunto de atualizado — mudou para cancelado
- `sem_alteracao`: existia, nada mudou
- `rejeitado`: dados insuficientes (CPF/nome ausente)
- `duplicidade_descartada`: repetido dentro do mesmo lote

### 3.7 — Relatório retornado
```json
{
  "success": true,
  "mode": "update",
  "total_fetched": 5000,
  "inserted": 12,
  "updated": 45,
  "paid": 8,
  "cancelled_maxlist": 3,
  "unchanged": 4920,
  "rejected": 5,
  "duplicates_discarded": 10,
  "errors": 0,
  "duration_ms": 12345,
  "updated_records": [{ "nome": "...", "cpf": "...", "changes": {...} }]
}
```

### 3.8 — Modo `import`
- Mantém lógica atual de upsert em batch
- Mas aplica mesma regra de status YBRASIL (`cancelado_maxlist` em vez de `quebrado`)
- Retorna relatório expandido com os novos contadores

---

## Bloco 4: Relatório Final Expandido

### 4.1 — Expandir `ImportReport` interface
```typescript
export interface ImportReport {
  inserted: number;
  updated: UpdatedRecord[];
  rejected: RejectedRecord[];
  skipped: number;
  unchanged: number;       // novo
  paid: number;            // novo
  cancelledMaxlist: number; // novo
  duplicatesDiscarded: number; // novo
  totalFetched: number;    // novo
  durationMs: number;      // novo
  mode: "import" | "update"; // novo
}
```

### 4.2 — Expandir `ImportResultDialog`
- Adicionar badges para: sem alteração, pagos, cancelados, duplicidades
- Mudar título conforme `mode`: "Resultado da Importação" / "Resultado da Atualização"
- Manter accordion com detalhes de atualizados e rejeitados
- Download Excel com todas as categorias

---

## Bloco 5: Auditoria

### 5.1 — Edge function loga em `audit_logs` e `import_logs`
- Ação: `maxlist_import` ou `maxlist_update`
- Detalhes incluem todos os contadores + filtros + duração
- Campo `module: "maxlist"` nos details
- Apenas tenant YBRASIL terá esses logs

---

## Bloco 6: Limpeza de Referências Legadas

- `ClientForm.tsx`: remover default "MAXFAMA" do credor — usar primeiro credor do tenant ou vazio
- `importService.ts`: remover fallback "MAXFAMA" — usar credor selecionado ou vazio
- `CredorReguaTab.tsx`: trocar exemplo "MAXFAMA" por "Empresa Exemplo"

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/maxlist-import/index.ts` | Mode import/update, diff inteligente, status cancelado_maxlist, relatório expandido |
| `supabase/functions/maxsystem-proxy/index.ts` | Validar maxlist_enabled |
| `src/pages/MaxListPage.tsx` | Restrição por settings, dois botões, relatório expandido |
| `src/components/maxlist/ImportResultDialog.tsx` | Interface expandida, novos contadores, título dinâmico |
| `src/components/AppLayout.tsx` | Condicionar menu MaxList a settings |
| `src/components/clients/ClientForm.tsx` | Remover "MAXFAMA" hardcoded |
| `src/services/importService.ts` | Remover fallback "MAXFAMA" |
| `src/components/cadastros/CredorReguaTab.tsx` | Trocar exemplo |

## O que NÃO muda
- Layout, design, componentes visuais existentes — intactos
- Lógica de negócio dos demais módulos — intacta
- Estrutura de tabelas — intacta (status `cancelado_maxlist` é valor string no campo `status` existente)
- Fluxos operacionais aprovados — preservados
- Outros tenants — zero impacto

## Ordem de implementação
1. Edge function `maxlist-import` (mode + diff + status + relatório)
2. Edge function `maxsystem-proxy` (validação)
3. `MaxListPage` (restrição + dois botões + relatório)
4. `ImportResultDialog` (interface expandida)
5. Limpeza de referências legadas

