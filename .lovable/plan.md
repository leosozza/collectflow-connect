# Melhorias visuais no painel de "Próximo disparo" da campanha

## Problema atual

No `CampaignSummaryTab` o card verde mostra apenas dois estados:

- "Pausa anti-ban ativa — Retomando em Xs" (quando `meta.batch_resting = true`)
- "Próximo envio em breve — ~Xs para o próximo disparo" (caso contrário)

Quando o contador chega a `0s` e o próximo chunk demora alguns segundos para realmente disparar (overhead do worker, watchdog, anti-ban entre lotes), o usuário vê "0s para o próximo disparo" parado e acha que travou. Também não diferencia "pausa curta entre mensagens" de "pausa longa anti-ban entre lotes".

## Objetivo

Mudança puramente de UI/UX no card de status — sem alterar lógica de envio, anti-ban ou backend. Comunicar com clareza:

1. Próximo disparo previsto em X segundos (com unidade certa: s ou min)
2. Pausa curta anti-ban (entre mensagens da mesma instância)
3. Pausa longa anti-ban (descanso de lote — `batch_resting`) com nome da instância
4. "Disparando agora..." quando o contador zera, ao invés de ficar "0s" parado
5. "Aguardando worker..." se passar muito tempo após o zero sem novo `last_chunk_at`

## Mudanças (apenas em `CampaignSummaryTab.tsx`)

### 1. Refinar `rateInfo` para expor mais estados

Adicionar novas variantes ao retorno do `useMemo`:

- `kind: "dispatching"` — quando `remainingMs <= 0` e faz < ~8s do último chunk → mostra "Disparando agora..."
- `kind: "waiting_worker"` — quando `remainingMs <= 0` e faz ≥ 8s sem novo chunk → mostra "Aguardando worker retomar..."
- `kind: "next"` (existente) — countdown normal > 0
- `kind: "resting"` (existente) — pausa anti-ban longa
- `kind: "short_pause"` — pausa curta anti-ban entre mensagens (quando `avgDelayMs` está no intervalo curto, ex.: > 5s e < 30s)

Manter os mesmos inputs (`meta.last_chunk_at`, `meta.batch_resting`, `RATE_CONSTANTS`) — só refinar a classificação.

### 2. Formatar tempo de forma humana

Helper local `formatCountdown(sec)`:
- `< 60s` → `"Xs"`
- `≥ 60s` → `"Xmin Ys"` ou `"~Xmin"`

### 3. Reescrever o card visual com 4 visuais

| Estado | Cor / Ícone | Título | Subtítulo |
|---|---|---|---|
| `next` | verde / Clock | "Próximo disparo em {tempo}" | "Ritmo normal de envio" |
| `short_pause` | âmbar suave / Timer | "Pausa curta anti-ban — {tempo}" | "Aguarda intervalo entre mensagens" |
| `resting` | laranja / Pause | "Pausa anti-ban ativa{ em instância}" | "Retomando em {tempo} — protege contra bloqueio" |
| `dispatching` | verde + spinner / Loader2 | "Disparando agora..." | "Enviando próximo lote" |
| `waiting_worker` | âmbar / AlertTriangle | "Aguardando retomada do worker" | "Sem novo envio há {tempo}. Watchdog retoma em até 1 min." |

Badge da direita acompanha: "Em ritmo" / "Pausa curta" / "Em pausa" / "Disparando" / "Aguardando".

### 4. Nunca exibir "0s"

Sempre que `remainingSec <= 0`, troca para `dispatching` ou `waiting_worker` — assim o relógio nunca trava em zero.

### 5. Tick do contador

Manter o `setInterval(1000)` já existente. Sem novas queries / sem mudança no `refetchInterval` (5s).

## Fora de escopo

- Lógica de envio, anti-ban, watchdog, edge functions
- Schema de `progress_metadata`
- Banner de "Disparo pausado pelo limite" (`isStalled`) — continua igual
- Outros tabs e KPIs

## Aceite

- Contador nunca fica visível em "0s" parado
- Card distingue claramente pausa curta (entre mensagens) de pausa longa (anti-ban de lote)
- Quando zera e leva alguns segundos pra próximo chunk, aparece "Disparando agora..." com spinner
- Se passa de 8s sem novo chunk, aparece "Aguardando retomada do worker" em âmbar
