

## Plano: redesenhar o gráfico "Status dos Destinatários" no padrão rounded donut

### Visual alvo (referência da imagem)

Donut chart com fatias arredondadas, espaçadas, labels numéricos brancos sobre cada fatia, dentro de um Card com título e badge de variação. Mantém o `chart.tsx` atual (sem duplicar para `pie-chart.tsx`).

### Cores fixas por status (semânticas, não por ordem)

| Status     | Cor          | Token                    |
|------------|--------------|--------------------------|
| Enviado    | Azul         | `hsl(var(--primary))` (já é laranja RIVO) → usar `hsl(217 91% 60%)` para azul puro |
| Entregue   | Verde        | `hsl(142 71% 45%)`       |
| Falhou     | Vermelho     | `hsl(var(--destructive))`|
| Pendente   | Cinza        | `hsl(var(--muted-foreground))` |
| Processando| Cinza claro  | `hsl(var(--muted))`      |
| Lido       | Verde escuro | `hsl(142 71% 35%)`       |

Atualizar o mapa `STATUS_PIE_COLORS` em `CampaignSummaryTab.tsx` com essas cores fixas conforme regra do usuário (Falhou=Vermelho, Enviado=Azul, Entregue=Verde, Pendente=Cinza).

### Mudanças de estrutura no `<PieChart>`

No componente `CampaignSummaryTab.tsx`, dentro do Card "Status dos destinatários":

1. **Donut arredondado**: trocar o `<Pie>` atual por:
   - `innerRadius={60}` (donut, não pie sólido)
   - `outerRadius={100`
   - `cornerRadius={8}` (cantos arredondados)
   - `paddingAngle={4}` (espaço entre fatias)
   - Remover `label` externo do Pie (linhas conectoras saem).

2. **LabelList interno**: adicionar `<LabelList dataKey="value" position="inside" fill="#fff" fontSize={12} fontWeight={600} formatter={(v) => v.toString()} />` para mostrar o número dentro da fatia em branco.

3. **ChartContainer**: envolver o `<PieChart>` com `<ChartContainer config={chartConfig}>` (já importado de `@/components/ui/chart`) com `className="mx-auto aspect-square max-h-[280px] [&_.recharts-text]:fill-white"`.

4. **Tooltip**: usar `<ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />` para tooltip estilizado consistente com o design system.

5. **Legenda**: manter a legenda atual abaixo (com bullets coloridas e contagem) — já está boa e dá contexto que labels internos não dão.

6. **Card header**: manter título "Status dos destinatários" e adicionar `CardDescription` com período da campanha (ex.: data de criação → última atividade) se disponível no objeto `campaign`.

### Arquivos alterados

- `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` — ajustar `STATUS_PIE_COLORS`, refatorar `<PieChart>` para donut arredondado com `LabelList` interno e envolver em `ChartContainer`.

### Não muda

- `src/components/ui/chart.tsx` permanece como está (sem criar `pie-chart.tsx` duplicado).
- Lógica de agregação de status (`recipientStats`), legenda inferior e demais cards do summary tab.
- Tokens globais do design system.

### Validação

1. Abrir uma campanha em `/contact-center/whatsapp` → aba Resumo.
2. Confirmar donut arredondado com gap entre fatias e cantos suaves.
3. Confirmar cores: Enviado azul, Entregue verde, Falhou vermelho, Pendente cinza.
4. Confirmar números em branco dentro de cada fatia.
5. Confirmar tooltip ao passar o mouse mostrando label + valor.
6. Confirmar legenda inferior continua exibindo contagens.

