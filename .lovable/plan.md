## Problema

O relatório baixado (XLSX) hoje mostra:

- **Aba "Atualizados"** — usa UUIDs crus, ex.:
  `Status Cobrança: 35679541-...→ 6119c591-...; tipo_divida_id: null → 2cd925fd-...`
  → impossível o usuário entender que aquilo significa "Estava **Inadimplente**, agora **Em dia**".

- **Aba "Resumo"** — apenas números soltos (Total consultado, Atualizados, Pagos, Cancelados…) sem contexto do que cada um representa.

## Objetivo

Tornar o relatório autoexplicativo, em linguagem do operador, **sem alterar nenhuma lógica de sincronização**. Só a apresentação do XLSX e do dialog.

---

## O que vai mudar

### 1. Aba "Atualizados" — frases humanas

Para cada CPF, gerar uma coluna **"O que mudou"** com texto traduzido. Exemplos:

| Antes (hoje) | Depois |
|---|---|
| `Status Cobrança: 3567...→ 6119...` | `Status: Inadimplente → Em dia` |
| `tipo_divida_id: null → 2cd9...` | `Tipo de dívida: (vazio) → Cartão de Crédito` |
| `valor_pago: 0 → 250.00` | `Valor pago: R$ 0,00 → R$ 250,00` |
| `data_pagamento: null → 2026-03-12` | `Data de pagamento: — → 12/03/2026` |
| `status: vencido → pago` | `Status MaxSystem: Vencido → Pago` |

Como:

- No `ImportResultDialog.tsx`, antes de gerar o XLSX, buscar via Supabase:
  - `tipos_status` (id → nome) para resolver `status_cobranca_id`
  - `tipos_divida` (id → nome) para resolver `tipo_divida_id`
- Criar um `formatChange(field, old, new, dictionaries)` que:
  - Traduz o nome do campo (`fieldLabels` já existe, expandir).
  - Resolve UUIDs para nomes amigáveis.
  - Formata datas (`dd/MM/yyyy`), valores (`R$ x,xx`) e nulos (`—` / `vazio`).
- Aba "Atualizados" passa a ter colunas: **Nome | CPF | Contrato | Parcela | O que mudou** (uma linha por mudança em vez de tudo concatenado, fica muito mais legível ao filtrar).

### 2. Aba "Resumo" — com descrição

Trocar tabela só de números por tabela com 3 colunas: **Métrica | Valor | O que significa**.

Exemplo:

| Métrica | Valor | O que significa |
|---|---|---|
| Total consultado | 4.826 | Parcelas retornadas pelo MaxSystem no período |
| Novos inseridos | 123 | CPFs/parcelas que ainda não existiam na RIVO |
| Atualizados | 100 | Já existiam e tiveram algum dado alterado |
| Pagos | 124 | Marcados como pagos nesta sincronização (Inadimplente → Em dia/Quitado) |
| Cancelados MaxList | 93 | MaxSystem devolveu como cancelados/excluídos |
| Sem alteração | 2.515 | Já estavam idênticos à base — nada a fazer |
| Rejeitados | 5 | Linhas inválidas (CPF/contrato faltando, ver aba Rejeitados) |
| Duplicidades descartadas | 0 | Mesma parcela veio repetida no lote |
| Erros | 202 | Linhas que o banco recusou no chunk (ver aba Erros) |
| Tempo (s) | 52 | Duração total da sincronização |

### 3. Nova aba "Erros" (quando `report.skipped > 0`)

Hoje os erros aparecem só como número solto e ficam escondidos no log. Adicionar aba listando as mensagens de erro de chunk extraídas de `processingLogs` (ex.: `ON CONFLICT DO UPDATE...`) com chunk afetado, para o operador saber se precisa re-sincronizar.

### 4. Dialog (tela) — mesma melhoria

No accordion "Atualizados", trocar o render de `{val.old} → {val.new}` pelo mesmo `formatChange()` — assim a tela e o XLSX falam a mesma língua.

---

## Detalhes técnicos

- Arquivo único alterado: `src/components/maxlist/ImportResultDialog.tsx`.
- Adicionar 2 selects leves (`tipos_status` e `tipos_divida` filtrados pelo `tenant_id` atual) só quando o dialog abre, com cache em `useMemo`.
- `fieldLabels` expandido com todos os campos que aparecem em `changes` no backend (já mapeados em `maxlist-import/index.ts` linhas 65–71).
- **Nada muda no edge function** `maxlist-import`. O payload `changes` continua igual; só a renderização melhora.
- Sem migrations, sem alteração de regras de status, sem reprocessamento.

---

## Fora do escopo

- Não mexer na lógica de upsert / chunks / `auto-status-sync`.
- Não reprocessar atualizações antigas (combinado: "desconsiderar e atualizar novos daqui pra frente").
- Não alterar o XLSX de "Pagamentos_MaxSystem" da página principal.
