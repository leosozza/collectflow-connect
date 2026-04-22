

## Horário de disparo na Régua + janela e throttle anti-ban

### Conceito

Cada regra ganha **horário próprio** de disparo. O motor (`send-notifications`) passa a rodar de 15 em 15 minutos e, a cada execução, só dispara regras cuja **janela horária** (timezone America/Sao_Paulo) esteja ativa naquele instante. Entre mensagens, aplica delay aleatório para não rajar.

### 1) Schema — novos campos em `collection_rules`

| Campo | Tipo | Default | Função |
|---|---|---|---|
| `send_time_start` | `time` | `09:00` | Hora local (BRT) para começar a disparar |
| `send_time_end` | `time` | `18:00` | Hora limite — após isso, regra não dispara mais hoje |
| `min_delay_seconds` | `int` | `8` | Delay mínimo entre 2 envios da regra |
| `max_delay_seconds` | `int` | `15` | Delay máximo (random uniforme entre min e max) |
| `daily_cap` | `int` | `null` | Teto opcional de envios/dia por regra (null = ilimitado) |

Validação por trigger: `send_time_start < send_time_end`, `min_delay_seconds <= max_delay_seconds`, `min_delay_seconds >= 3`.

Defaults seguros mantêm comportamento atual para regras existentes (todas passam a rodar 09–18h com delay 8–15s).

### 2) Motor `send-notifications` — janela + throttle + cap

- Computar `nowBRT` via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`.
- Para cada regra ativa: pular se `nowBRT.time < send_time_start` ou `>= send_time_end`.
- Antes do loop de envios, contar `message_logs` `sent` da regra hoje; se já atingiu `daily_cap`, pular.
- Após cada envio bem-sucedido, `await sleep(random(min,max)*1000)` antes do próximo. Se durante o sleep o relógio ultrapassar `send_time_end`, parar a regra (logar `skipped_after_window`).
- Como a edge function tem ~400s de teto, o motor processa o que conseguir e o **próximo ciclo do cron (15min depois)** continua de onde parou — idempotência por `message_logs` já garante não duplicar.

### 3) Cron — de 1x/dia para a cada 15min

Atualizar job `send-notifications-daily` (atual `0 11 * * *`) para `*/15 * * * *` e renomear para `send-notifications-tick`. Com a janela por regra, disparos ficam concentrados no horário configurado mesmo rodando 96x/dia.

### 4) UI — card "Agendamento e Anti-Ban" no Dialog (`CredorReguaTab.tsx`)

Novo bloco abaixo de "Dias em relação ao vencimento":

```text
┌─ Agendamento e Boas Práticas ──────────────────────┐
│ Janela de envio:  [09:00] até [18:00] (horário BRT)│
│ Delay entre msgs: [ 8 ] a [ 15 ] segundos          │
│ Limite diário:    [____]  (vazio = sem limite)     │
│ ℹ Sistema espalha disparos dentro da janela e usa  │
│   delay aleatório para evitar bloqueio do WhatsApp.│
└────────────────────────────────────────────────────┘
```

- 2 inputs `type="time"` (start/end), 2 numéricos (min/max delay), 1 numérico opcional (cap).
- Validação client-side espelhando o trigger SQL.
- Estado e payload incluídos em `handleSave` (criar/editar).
- Tabela de regras ganha coluna **"Horário"** mostrando `09:00–18:00`.

### 5) Service `automacaoService.ts`

Adicionar 5 campos em `CollectionRule` e propagar em `createCollectionRule` / `updateCollectionRule` (já é `Omit/Partial`, basta o tipo).

### 6) Validação

1. Aplicar migration (defaults seguros).
2. Editar a regra "DIA D" — setar janela 14:00–15:00 e cap 5.
3. Trocar cron para `*/15`.
4. Aguardar próximo tick: `message_logs` mostra ≤5 sent dentro da janela; logs do edge mostram delay 8–15s entre `sent_at` consecutivos.
5. Tick fora da janela (ex: 16h): regra é pulada, log `[send-notifications] rule=X out-of-window`.
6. Re-tick dentro da janela mesmo dia: cap respeitado, `skipped_cap` logado.

### Arquivos alterados

- `supabase/migrations/<nova>.sql` — 5 colunas + trigger de validação + atualizar `cron.job` (`*/15 * * * *`).
- `supabase/functions/send-notifications/index.ts` — janela BRT, sleep entre envios, daily cap.
- `src/services/automacaoService.ts` — tipo `CollectionRule` com novos campos.
- `src/components/cadastros/CredorReguaTab.tsx` — card "Agendamento e Boas Práticas", coluna "Horário" na tabela.

### Fora de escopo

- Janela diferente por dia da semana (seg–sex vs sáb).
- Pausa em feriados.
- Dashboard de "ritmo de disparo da régua" em tempo real.

