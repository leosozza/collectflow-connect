

## Adicionar seletor de data em "Agendados" e "Parcelas Programadas"

Padronizar os dois cards do Dashboard com um seletor de data idêntico (◀ data ▶), exibindo "HOJE" quando for o dia atual e `dd/MM/yyyy` nos demais dias. Renomear "Agendamentos para Hoje" para "Agendados".

### Mudanças por arquivo

**1. `src/hooks/useScheduledCallbacks.ts`**
- Aceitar parâmetro opcional `date: Date` (default = hoje).
- Substituir o filtro fixo `today/tomorrow` pelo intervalo `startOfDay(date)` → `endOfDay(date)`.
- Re-fetch automático quando a data muda.

**2. `src/components/dashboard/ScheduledCallbacksCard.tsx`**
- Receber props `selectedDate: Date` e `onDateChange: (d: Date) => void`.
- Trocar título para **"Agendados"**.
- Adicionar header com seletor: `[◀] [HOJE | dd/MM/yyyy] [▶]` no mesmo padrão visual do `ScheduledInstallmentsCard` (botão central abre Popover com `<Calendar>` para escolher data arbitrária).
- Manter badge com a contagem de agendamentos da data selecionada.
- Lógica `isPast`/`isNear` (vermelho/pulse) só se aplica quando `selectedDate` é hoje.

**3. `src/pages/DashboardPage.tsx`**
- Criar estado local `scheduledDate` (default `new Date()`).
- Passar `scheduledDate` para `useScheduledCallbacks(scheduledDate)` e para o card.

**4. `src/components/dashboard/ScheduledInstallmentsCard.tsx`** (corrigir exibição)
- Quando a data selecionada for hoje, exibir **"HOJE"** no botão central em vez de `23/04/2026`.
- Demais dias permanecem em `dd/MM/yyyy`.

### Padrão visual do seletor (compartilhado)

```
[◀]  [ HOJE ]  [▶]      ← quando data == hoje
[◀]  [24/04/2026]  [▶]  ← demais dias
```

Botão central clicável abre `<Popover>` com `<Calendar>` para pular para qualquer data.

### Não incluído

- Sem alteração no schema do banco nem nas RPCs.
- Sem persistência da data selecionada (reseta ao recarregar — comportamento idêntico ao card de parcelas).
- Sem sincronização entre os dois seletores (cada card mantém sua própria data).

