

# Plano: Corrigir campo `impact` na sincronizacao de tabulacoes

## Problema

O log da edge function mostra erro 422 em todas as tabulacoes durante a sincronizacao:

```
errors: {"impact":["O campo impact deve ser uma string.","O campo impact não contém um valor válido"]}
```

Na linha 1042 do proxy, o `impact` e enviado como inteiro (`0` ou `1`), mas a API 3CPlus espera uma **string** (`"positive"` ou `"negative"`).

O toast no frontend mostrou sucesso porque a vinculacao das campanhas funcionou, mas nenhuma qualificacao foi criada/atualizada remotamente.

## Correcao

### `supabase/functions/threecplus-proxy/index.ts` — linha 1042

Trocar:
```typescript
payload.impact = disp.impact === 'positivo' ? 1 : 0;
```

Por:
```typescript
payload.impact = disp.impact === 'positivo' ? 'positive' : 'negative';
```

### `src/components/cadastros/CallDispositionTypesTab.tsx`

Melhorar o feedback do sync: se o `resultMap` retornado estiver vazio ou parcial, mostrar toast de warning em vez de sucesso, indicando que algumas tabulacoes falharam na 3CPlus.

## Arquivo a editar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Corrigir `impact` para string (`positive`/`negative`) |
| `src/components/cadastros/CallDispositionTypesTab.tsx` | Toast de warning quando sync parcial |

