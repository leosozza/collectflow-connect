

# Plano: Corrigir campos da API de criacao de intervalos 3CPlus

## Problema

O erro 422 da 3CPlus mostra exatamente os campos incorretos:

```
limit: O campo limit é obrigatório.
type: O campo Tipo é obrigatório.
return_type: O campo Tipo de retorno deverá conter um número inteiro.
```

O proxy envia `minutes` mas a API espera `limit`. O campo `type` (classificacao) nunca e enviado. O `return_type` e enviado como string ("flexible") mas a API espera inteiro.

## Correcoes

### `supabase/functions/threecplus-proxy/index.ts`

Nos cases `create_work_break_group_interval` e `update_work_break_group_interval`:

- Trocar `minutes` por `limit` (campo obrigatorio)
- Trocar `classification` por `type` com mapeamento para inteiro: `productive=1, unproductive=2, nr17=3`
- Converter `return_type` de string para inteiro: `flexible=1, automatic=2, request=3`
- Trocar `daily_limit` por `maximum_daily_time` (nome provavel da API)

### `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx`

- Tornar `classificacao` obrigatoria no formulario (validacao antes de salvar)
- Tornar `return_type` obrigatorio (validacao antes de salvar)
- Ajustar leitura dos dados ao abrir edicao: mapear inteiros de volta para strings (type 1→"productive", return_type 1→"flexible")

## Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Corrigir nomes dos campos e converter para inteiros |
| `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` | Validar campos obrigatorios, mapear inteiros na leitura |

