## Objetivo

Adicionar separadores de data entre as mensagens do WhatsApp, no padrão clean e discreto que o próprio app utiliza (uma "pílula" centralizada com Hoje / Ontem / data).

## Como será

Entre as mensagens, sempre que o **dia** mudar em relação à mensagem anterior, inserir uma pílula central com o rótulo da data:

- Mensagem de hoje → **Hoje**
- Mensagem de ontem → **Ontem**
- Últimos 7 dias → **dia da semana** (ex.: "Quarta-feira")
- Anterior → **dd/MM/yyyy** (ex.: "24/04/2026")

Sempre em pt-BR, sem emojis.

### Estilo visual (clean & discreto)

```
            ─────  Hoje  ─────
[mensagem 1]
[mensagem 2]

            ─────  Ontem  ─────
[mensagem 3]
```

- Pílula centralizada (`mx-auto`), padding `px-3 py-1`.
- Background `bg-muted/70` com `backdrop-blur-sm`, borda sutil `border-border/50`, raio `rounded-full`.
- Texto `text-[11px] font-medium text-muted-foreground uppercase tracking-wide`.
- Margem vertical `my-3` para respirar entre blocos sem destoar.
- Usa apenas tokens semânticos do design system (sem cores hardcoded).

## Arquivos alterados

- **`src/components/contact-center/whatsapp/ChatPanel.tsx`** — alterar o `messages.map` para intercalar um componente `<DateSeparator label="..." />` quando `isSameDay(prev, curr)` for falso.
- **`src/components/contact-center/whatsapp/DateSeparator.tsx`** (novo) — componente puro de apresentação da pílula.

Sem mudanças no banco, no `ChatMessage.tsx` (timestamp HH:mm da mensagem permanece) ou em outros lugares.

## Implementação técnica

- Reaproveitar `date-fns` (já em uso no projeto, ver `format` em `ChatMessage.tsx`).
- Usar `isSameDay`, `isToday`, `isYesterday`, `differenceInCalendarDays` e `format` com `locale: ptBR`.
- Lógica em um `useMemo` para evitar recomputar a cada render: percorrer `messages` uma vez e produzir uma lista de itens `{ type: "separator" | "message", ... }`.

**Posso aplicar?**