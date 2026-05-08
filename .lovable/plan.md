## Objetivo

1. Padronizar **cores de variação %** em todo o sistema: positivo → verde, negativo → vermelho, igual (0%) → azul.
2. Padronizar **formato de %** em todo o sistema: sempre `XX,XX%` (até 2 casas decimais, vírgula, com sinal `+`/`−`).
3. Ajustar **hierarquia tipográfica** dos KPIs no Dashboard:
   - Cards com **R$** (Quebra, Pendentes, Colchão): fonte menor para não quebrar em duas linhas.
   - Cards com **número puro** (Acionados Hoje, Acordos Dia, Acordos do Mês): fonte maior, número como herói.

Sem mexer em RLS, schema, edge functions ou regras de negócio (Regra 1 e Regra 7 preservadas).

---

## 1. Util compartilhado de trend (`src/lib/trendFormat.ts` — novo)

Centraliza o cálculo para o sistema inteiro:

```text
formatTrendPct(current, previous, { invert?: boolean }) →
  { value: "+12,34%" | "−5,80%" | "0,00%",
    tone: "positive" | "negative" | "neutral",
    raw: number }
  | null
```

Regras:
- 2 casas decimais sempre, vírgula como separador (pt-BR), com sinal explícito (`+`, `−`, ou nenhum em `0,00%`).
- `tone`:
  - `current === previous` (delta 0) → `neutral` (azul).
  - Caso contrário, `isUp = current > previous`. Se `invert=true` (métricas onde subir é ruim, ex.: Quebra/Pendentes), inverte.
  - Resultado → `positive` (verde) ou `negative` (vermelho).
- Edge cases: ambos 0 → retorna `null` (sem trend). `previous = 0` e `current > 0` → `+100,00%` com tone respeitando `invert`.

Classes mapeadas:
```text
positive → text-emerald-600
negative → text-red-500
neutral  → text-blue-500
```

## 2. Refactor de `pctDelta` em `DashboardPage.tsx`

Substituir a função local por chamadas a `formatTrendPct`. A interface `TrendData` em `KpisGridCard` ganha `tone: "positive" | "negative" | "neutral"` (mantém `isPositive` por compatibilidade ou removemos — vou remover, já que só `KpisGridCard` consome).

## 3. `KpisGridCard.tsx` — UI ajustada

Dois tamanhos de tile via prop nova `valueSize?: "lg" | "md"`:

- `lg` (números puros): `text-3xl lg:text-[32px] font-bold tracking-tight`.
  - Aplicado em: Acionados Hoje, Acordos do Dia, Acordos do Mês.
- `md` (currency): `text-lg lg:text-xl font-bold tracking-tight`, com `whitespace-nowrap` removido e `break-words` substituído por layout que mantém em **uma linha** quando couber.
  - Aplicado em: Total de Quebra, Pendentes, Colchão de Acordos.

Cores do trend agora vêm do `tone`:
```text
tone=positive → text-emerald-600/90
tone=negative → text-red-500/90
tone=neutral  → text-blue-500/90
```

Texto auxiliar (`vs mesmo período`, `vs ontem`) continua em `text-muted-foreground/55`.

## 4. Aplicação em outros lugares do sistema

Varredura para usar o mesmo util onde houver "vs mês anterior" / `isPositive` / cálculo de %:
- `src/components/StatCard.tsx` — atualmente recebe `trend` como `string`. **Não toco** no formato externo (consumidores passam string pronta) — mas vou listar callsites para confirmar que nenhum monta string com 0 casas decimais que conflite com a regra. Se algum monta dinamicamente, redireciono para `formatTrendPct`.
- `src/components/dashboard/KPICards.tsx` — usa `trend?: number`. Vou padronizar o ícone de tendência para também usar a regra (azul quando 0). Formatação de % aqui não é exibida (só ícone), então só ajusto o `TrendIndicator`.
- Rápida busca por `%` e `vs mês` em `src/components` e `src/pages` para garantir cobertura. Onde houver `toFixed(0)` em porcentagens visíveis, troco para o util.

Sem alterar componentes que mostram % em outros contextos não-trend (ex.: progresso de meta, comissão), pois a regra do usuário é especificamente para indicadores comparativos.

## 5. Governança

- Sem alteração em queries, RPC, schema, RLS ou edge functions.
- `tenantId` continua sendo passado em `DashboardMetaCard`.
- Regra 7 (metas): nada tocado.
- Apenas `lib/trendFormat.ts` (novo), `DashboardPage.tsx`, `KpisGridCard.tsx`, e ajuste mínimo em `KPICards.tsx`.

## Arquivos afetados

- **novo** `src/lib/trendFormat.ts`
- `src/pages/DashboardPage.tsx` — usa o util, passa `tone`, e ajusta `valueSize` por tile
- `src/components/dashboard/KpisGridCard.tsx` — `tone` no trend, prop `valueSize`, classes de fonte por tamanho
- `src/components/dashboard/KPICards.tsx` — `TrendIndicator` reconhece estado neutro (azul)

## Validação

- Visual no viewport atual (1678×1108): currency em uma linha, números puros maiores e centralizados.
- Trend: testar mês com delta positivo (verde), negativo (vermelho) e igual (azul).
- Conferir formatação `+12,34%` / `−5,80%` / `0,00%`.
