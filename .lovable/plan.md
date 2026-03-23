
# Plano: Corrigir exibição do tempo nos intervalos de pausa

## Diagnóstico

Testei a API 3CPlus diretamente e confirmei que o campo retornado é `minutes` (em minutos), **não** `maximum_time` nem `max_time`. Exemplo da resposta real:

```json
{ "id": 33098, "name": "Almoço", "minutes": 60, "limit": 60, "type": "NR17", "color": "#c62828" }
```

O código atual verifica `interval.maximum_time || interval.max_time` — ambos inexistentes, por isso tudo mostra "Sem limite".

Além disso, o proxy envia `maximum_time` em segundos no create/update, mas a API espera `minutes` em minutos.

## Correções

### 1. `supabase/functions/threecplus-proxy/index.ts`

- **create_work_break_group_interval**: trocar `intervalBody.maximum_time = Number(body.max_time) * 60` por `intervalBody.minutes = Number(body.max_time)` (o valor já vem em minutos do UI)
- **update_work_break_group_interval**: trocar `updateBody.maximum_time = Number(body.max_time) * 60` por `updateBody.minutes = Number(body.max_time)`

### 2. `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx`

- **Exibição (linha 217)**: trocar `(interval.maximum_time || interval.max_time)` por `interval.minutes`, sem divisão por 60 (já está em minutos)
- **Edição (linha 220)**: preencher campo com `interval.minutes` direto
- Manter fallback para `interval.maximum_time` e `interval.limit` por segurança

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Trocar `maximum_time` → `minutes`, remover conversão ×60 |
| `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` | Ler campo `minutes` da resposta da API |
