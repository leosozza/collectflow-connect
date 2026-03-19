

# Plano: Corrigir sincronização de tabulações com 3CPlus

## Problema identificado

A lista "RIVO Tabulações" é criada com sucesso no 3CPlus, porém as qualificações individuais não aparecem dentro dela. Analisando o código da edge function `threecplus-proxy`, identifiquei dois problemas:

1. **Campos insuficientes**: Ao criar cada qualificação, o código envia apenas `{ name: disp.label }`. A API do 3CPlus provavelmente exige campos adicionais como `color`, `positive_impact`, `behavior`, etc.

2. **Erros silenciosos**: O código não valida a resposta do `createItemRes` — se a API retorna erro, ele ignora silenciosamente e o `newItem.id` fica `undefined`.

## Mudanças

### 1. Edge function `threecplus-proxy/index.ts` — Ação `sync_dispositions`

- Enviar os campos completos ao criar qualificações: `name`, `color`, `positive_impact` (boolean), `behavior` (mapeado para valores da API 3CPlus), `is_conversion`, `is_dmc` (CPC), `is_unknown`, `is_callback`, `is_schedule`, `is_blocklist`
- Adicionar verificação de `createItemRes.ok` e logging de erros
- Mapear os valores do RIVO para o formato esperado pela API 3CPlus (ex: `impact: "positivo"` → `positive_impact: true`)

### 2. Mapeamento de campos RIVO → 3CPlus

| Campo RIVO | Campo 3CPlus API |
|---|---|
| `label` | `name` |
| `color` (hex) | `color` (hex) |
| `impact === "positivo"` | `positive_impact: true` |
| `behavior` | `behavior` (repetir/nao_discar_telefone/nao_discar_cliente) |
| `is_conversion` | `is_conversion` |
| `is_cpc` | `is_dmc` |
| `is_unknown` | `is_unknown` |
| `is_callback` | `is_callback` |
| `is_schedule` | `is_schedule` |
| `is_blocklist` | `add_blocklist` |
| `schedule_allow_other_number` | `allow_schedule_for_another_number` |
| `schedule_days_limit` | `schedule_days_limit` |
| `blocklist_mode` | `blocklist_time_type` |
| `blocklist_days` | `blocklist_days` |

### 3. Atualizar payload enviado pelo `dispositionService.ts`

Incluir os campos `schedule_allow_other_number`, `schedule_days_limit`, `blocklist_mode`, `blocklist_days` no payload enviado para a edge function.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Enviar campos completos + error handling na criação de qualificações |
| `src/services/dispositionService.ts` | Incluir campos de agendamento/bloqueio no payload de sync |

