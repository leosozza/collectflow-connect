## Problema

As campanhas "CAMPANHA MENSAL" e "CAMPANHA SEMANAL" estão configuradas com:
- `end_date = 2026-04-30`
- `end_time = 17:45:00` (fuso de São Paulo)
- `status = ativa`

Agora são ~10:33 (BRT) de 2026-04-30, então elas deveriam aparecer como **Ativas** com countdown "00:07:11:xx". Em vez disso, aparecem como **Encerradas**.

## Causa Raiz

A lógica `isCampaignActive` (em `CampaignsTab.tsx`, `CampaignsManagementTab.tsx` e `CampaignCard.tsx`) usa:

```ts
differenceInDays(parseISO(campaign.end_date), new Date()) >= 0
```

Dois problemas:
1. **Ignora `end_time`**: lê apenas `end_date` (data sem hora), perdendo o horário 17:45 configurado no formulário.
2. **`differenceInDays` é truncado**: hoje vs hoje retorna `0`, mas se o relógio do navegador estiver alguns segundos à frente do início do dia em UTC vs BRT, pode dar `-1` e marcar como encerrada cedo. Pior: ele compara o `end_date` parseado como meia-noite UTC contra `new Date()` local — para um usuário em BRT (UTC-3), `parseISO("2026-04-30")` vira `2026-04-30 00:00 UTC` = `2026-04-29 21:00 BRT`, ou seja, na manhã de 30/04 BRT já são +13h passadas do "fim", devolvendo `-1` → **Encerrada**.

O countdown (`CampaignCountdown.tsx`) também usa apenas `endDate` sem `end_time`, mas só é renderizado quando `isActive=true`, então o card simplesmente exibe o badge "Encerrada".

## Correção

Criar uma única função utilitária que combina `end_date + end_time` no fuso de São Paulo e compara com `Date.now()` em **milissegundos**, e usá-la em todos os lugares.

### Arquivos a alterar

**1. Novo helper `src/components/gamificacao/campaignTime.ts`** (utilitário compartilhado)
- `getCampaignEndMs(campaign)`: retorna o timestamp (ms) do fim real, montando `YYYY-MM-DDTHH:mm:ss-03:00` (BRT). Se `end_time` for nulo, usa `23:59:59`.
- `getCampaignStartMs(campaign)`: análogo, com `00:00:00-03:00` se faltar `start_time`.
- `isCampaignActive(campaign)`: `status === "ativa" && datas válidas && getCampaignEndMs > Date.now()`.

Observação técnica sobre fuso: BRT atualmente não tem horário de verão (UTC-3 fixo), então o offset literal `-03:00` é correto e estável. É a mesma premissa já adotada na mensagem do form ("fuso de São Paulo").

**2. `src/components/gamificacao/CampaignsTab.tsx`**
- Remover o `isCampaignActive` local (que usa `differenceInDays`).
- Importar `isCampaignActive` do helper novo.

**3. `src/components/gamificacao/CampaignsManagementTab.tsx`**
- Mesma troca.

**4. `src/components/gamificacao/CampaignCard.tsx`**
- Substituir `daysLeft = differenceInDays(...)` + `isActive` por `isCampaignActive(campaign)` do helper.
- Passar o timestamp de fim (em ms ou ISO completo com hora) para `<CampaignCountdown />` em vez de só `campaign.end_date`.

**5. `src/components/gamificacao/CampaignCountdown.tsx`**
- Mudar a prop para `endMs: number` (ou aceitar string ISO completa).
- Manter o `setInterval` de 1s já existente.

### Impacto colateral

- Nada no front-end visual muda: badges, layout, cores e textos permanecem idênticos.
- Não há mudanças de schema nem em RPCs. O backend (`gamification_campaigns.end_time`) já guarda o horário corretamente — o bug é puramente client-side.
- O cron `gamification-recalc-tick` e o status persistido `encerrada` no banco continuam funcionando como hoje (a UI só estava interpretando errado campanhas com `status='ativa'`).

### Validação após implementação

- "CAMPANHA MENSAL" e "CAMPANHA SEMANAL" devem aparecer em **Campanhas Ativas** com countdown contando até 17:45 BRT.
- Após 17:45, o card cai automaticamente para "Campanhas encerradas" no próximo tick (1s).
- Campanhas com `status='encerrada'` no banco continuam aparecendo como encerradas independentemente do horário.
