

# Plano: Corrigir criacao de intervalos — 422 silencioso

## Problema

Dois bugs combinados fazem o intervalo parecer criado mas nao ser salvo:

1. **A 3CPlus retorna 422** (validacao falhou), mas o proxy retorna HTTP 200 com `{ success: false, status: 422 }` no body. O `invoke` do frontend so checa `error` do Supabase (que e null porque o proxy retornou 200), entao mostra "Intervalo criado" sem verificar o campo `success`.

2. **Campo `minutes` provavelmente obrigatorio** — quando o usuario deixa "Tempo maximo" vazio, o proxy envia `{ name: "banheiro" }` sem `minutes`. A 3CPlus exige `minutes` para criar o intervalo. Os logs confirmam: `create_work_break_group_interval -> POST ... 422`.

## Correcoes

### 1. `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx`

**Verificar `success` na resposta do `invoke`**: Apos cada chamada, checar `data.success === false` e tratar como erro.

```typescript
const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
  const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
    body: { action, domain, api_token: apiToken, ...extra },
  });
  if (error) throw error;
  if (data && data.success === false) {
    throw new Error(data.detail || data.title || `Erro da 3CPlus (${data.status})`);
  }
  return data;
}, [domain, apiToken]);
```

**Tornar `minutes` obrigatorio no formulario**: Validar que `intervalMaxTime` esta preenchido antes de salvar. Adicionar validacao no `handleSaveInterval`.

**Exibir mensagem de erro detalhada**: No catch do `handleSaveInterval`, mostrar `err.message` no toast em vez de mensagem generica.

### 2. `supabase/functions/threecplus-proxy/index.ts`

**Logar o body da resposta 422**: Adicionar log do conteudo da resposta quando status >= 400 para facilitar debug futuro.

## Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/WorkBreakIntervalsPanel.tsx` | Validar `success` na resposta, tornar `minutes` obrigatorio, mostrar erro detalhado |
| `supabase/functions/threecplus-proxy/index.ts` | Logar body de respostas com erro |

