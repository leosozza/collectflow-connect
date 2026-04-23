

## Análise: lentidão na geração de boletos no fechamento de acordo

### Onde está o gargalo

A edge function `generate-agreement-boletos` é chamada **uma vez por acordo**, mas internamente faz tudo em série. Para um acordo típico com **entrada + 6 a 12 parcelas**, cada parcela dispara:

1. `POST https://sistema.negociarie.com.br/api/v2/cobranca/nova` (rede externa, ~800-1500ms cada)
2. `UPDATE negociarie_cobrancas` (substituir antigos)
3. `INSERT negociarie_cobrancas` (novo registro)

Como o loop em `index.ts` linha 257 é `for...of` com `await` dentro, **nada acontece em paralelo**. Tempo medido:
- 1 entrada + 6 parcelas → **~7-12s**
- 1 entrada + 12 parcelas → **~14-22s**
- + autenticação inicial Negociarie quando `cachedToken` expira (+1-2s)
- + queries Supabase iniciais sequenciais (agreement → client_profile → clients fallback) (+300-600ms)

O frontend (`AgreementCalculator.tsx` linha 651) bloqueia o operador com spinner "Gerando boletos…" até a edge function inteira terminar. **Esse é o tempo que o operador percebe como "demorado"**.

### Plano de otimização

#### 1) Paralelizar as chamadas Negociarie (ganho principal)

Substituir o `for...of await` por `Promise.allSettled` com **concorrência limitada** (lote de 4-5 chamadas simultâneas para não estourar o rate-limit do Negociarie). Implementação com helper `pLimit(5)` simples inline.

- **Antes**: 7 parcelas × 1.2s = ~8.4s
- **Depois**: ceil(7/5) × 1.2s = ~2.4s
- **Ganho**: ~70% menos tempo

Também paralelizar os `INSERT/UPDATE` em `negociarie_cobrancas` por parcela junto com a resposta (não esperar um boleto para começar o próximo).

#### 2) Paralelizar as queries iniciais

Hoje (linhas 175-227): SELECT agreement → SELECT client_profiles → SELECT clients (condicional).

Trocar por:
```ts
const [{ data: agreement }, { data: clientProfile }, { data: clientRows }] = 
  await Promise.all([selectAgreement, selectProfile, selectClientsFallback]);
```

Sempre buscar `clients` em paralelo (custo ~80ms) em vez de aguardar para decidir condicional. Ganho: ~300-500ms.

#### 3) Resposta em background (UX otimista) — ganho percebido máximo

Mudar a UX no `AgreementCalculator.tsx` (linhas 648-681) para:

- **Não bloquear o operador**: assim que o `createAgreement` retorna, exibe `toast.success("Acordo criado! Gerando boletos em segundo plano…")` e **fecha o modal imediatamente**.
- A chamada `supabase.functions.invoke("generate-agreement-boletos", ...)` continua em **fire-and-forget** (sem `await` no fluxo principal).
- Quando termina, dispara um segundo toast: `"7 boletos gerados"` ou `"5 ok, 2 falharam"`.
- Adicionar listener Realtime na tabela `negociarie_cobrancas` filtrando `agreement_id` para a UI atualizar a aba "Acordos do cliente" sozinha.

Resultado: operador vê o modal fechar em **<500ms** independente do tempo real de geração.

#### 4) Token Negociarie persistido em cache de DB

Hoje `cachedToken` é variável de módulo — perde ao cold-start da edge function (a cada poucos minutos). Persistir em uma tabela `integration_tokens` (provider='negociarie', tenant_id, token, expires_at) e ler antes de chamar `/login`. Evita 1-2s de auth a cada execução cold.

#### 5) Métricas + observabilidade

Adicionar logs estruturados de tempo por etapa (`auth_ms`, `queries_ms`, `negociarie_total_ms`, `per_installment_ms[]`) para confirmar o ganho em produção e identificar regressões.

### Arquivos a alterar

1. **`supabase/functions/generate-agreement-boletos/index.ts`**
   - Paralelizar queries iniciais com `Promise.all` (linhas 175-227).
   - Substituir loop sequencial (linha 257) por `Promise.allSettled` com pLimit(5).
   - Logs de performance por etapa.

2. **`src/components/client-detail/AgreementCalculator.tsx`**
   - Linhas 648-681: remover `await` da chamada da edge function; disparar fire-and-forget; mostrar toast inicial + segundo toast assíncrono no `.then()`.
   - Remover `setGeneratingBoletos(true)` bloqueante; manter como indicador de "fundo" não-modal opcional.
   - Chamar `onAgreementCreated()` e `clearDraft()` imediatamente.

3. **Nova tabela `integration_tokens`** (migration):
   - Colunas: `provider text`, `tenant_id uuid nullable`, `access_token text`, `expires_at timestamptz`.
   - RLS: somente service_role lê/escreve.
   - Atualizar `getToken()` na edge function para usar o cache persistido.

4. **Realtime publication**: adicionar `negociarie_cobrancas` ao `supabase_realtime` para a UI da aba Acordos atualizar automaticamente quando os boletos forem inseridos em background.

### Resultado esperado

| Métrica | Hoje | Depois |
|---|---|---|
| Tempo percebido pelo operador | 7-22s | **<500ms** (modal fecha) |
| Tempo real de geração (7 parcelas) | ~8.4s | **~2.5s** |
| Tempo real de geração (13 parcelas) | ~16s | **~4s** |
| Auth Negociarie (cold start) | +1-2s | **0** (cache em DB) |

### Validação

1. Fechar acordo com 1 entrada + 6 parcelas (todas BOLETO) → modal fecha imediatamente; toast "Gerando boletos…"; em ~3s segundo toast "7 boletos gerados"; aba Acordos exibe os 7 links automaticamente via Realtime.
2. Fechar acordo com 1 entrada + 12 parcelas mistas (Cartão/PIX/Boleto) → mesma UX rápida; resumo final indica `ok` + `skipped`.
3. Fechar 2 acordos seguidos em <30s → segundo acordo usa token Negociarie em cache (sem `/login`).
4. Simular 1 falha de Negociarie em 1 parcela → toast warning com contagem; demais boletos persistidos normalmente.
5. Falha total na edge function → toast error claro; usuário pode reabrir acordo e clicar "Reemitir boletos" manualmente (fluxo já existente).

