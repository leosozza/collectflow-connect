

# Plano: Corrigir salvamento de tempo nos Intervalos de Pausa

## Diagnóstico

O proxy envia o campo `max_time` no body do POST/PUT, e a UI lê `interval.max_time` da resposta. Porém a API 3CPlus provavelmente usa o campo `maximum_time` (em segundos), não `max_time`. Resultado: a API ignora o campo enviado, e ao listar, o campo `max_time` vem como `undefined`.

Evidências:
- Os logs confirmam que o PUT é chamado corretamente (status 200)
- Mas ao recarregar, o valor aparece como "Sem limite"
- O SDK da 3CPlus não documenta os nomes dos campos, mas o padrão da API usa `maximum_time`

## Correção

### 1. `supabase/functions/threecplus-proxy/index.ts`

**create_work_break_group_interval** (linha 618-619):
- Trocar `max_time` por `maximum_time` no body enviado
- Converter minutos (input do usuário) para segundos (API)
- Usar `body.max_time != null && body.max_time !== ''` em vez de `if (body.max_time)` (que falha para 0)

**update_work_break_group_interval** (linha 631-633):
- Trocar `max_time` por `maximum_time` no body enviado
- Converter minutos para segundos

### 2. `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx`

- Na exibição (linha 217): ler `interval.maximum_time` e converter segundos → minutos para exibir
- No edit (linha 220): preencher o campo com `interval.maximum_time / 60` ao abrir edição
- Fallback: tentar ambos `interval.maximum_time` e `interval.max_time` para compatibilidade

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Trocar campo `max_time` → `maximum_time`, converter min→seg |
| `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` | Ler `maximum_time`, converter seg→min na exibição |

