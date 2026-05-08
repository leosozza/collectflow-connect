## Mudança no card "Visão 360"

Reorganizar o card para mostrar 5 linhas, na ordem solicitada, com tamanhos bem distribuídos e usando a identidade visual existente (mesmas cores semânticas, mesmo estilo de barra/ícone).

### Nova estrutura do Visão 360

| # | Indicador | Origem do dado | Cor / token |
|---|---|---|---|
| 1 | **Colchão de Acordos** | `stats.total_projetado` (hoje exibido no `DashboardMetaCard`) | `--primary` (laranja, ícone `Wallet`) |
| 2 | **Provisionado no Mês** | `stats.total_negociado` (já usado hoje) | `--primary` em tom secundário (ícone `TrendingUp`) |
| 3 | **Total Previsto no Mês** = Colchão + Provisionado | soma das duas linhas acima | destaque visual: card/linha com fundo levemente preenchido (`bg-primary/10`) e ícone `Layers`/`Sigma`, tipografia maior — funciona como "linha-resumo" |
| 4 | **Pendentes** | `stats.total_pendente` | `--warning` (ícone `Hourglass`) |
| 5 | **Quebra** | `stats.total_quebra` | `--destructive` (ícone `TrendingDown`) |

A linha 3 **não** entra no cálculo do `maxValue` da barra (ela é só um total/resumo), para não distorcer as barras dos itens 1, 2, 4 e 5.

### Distribuição de tamanhos dentro do card

```text
┌─────────────────────────── Visão 360 (header) ──────────────────┐
│  [ico] Colchão de Acordos ............................ R$ X,XX │  linha normal
│  ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱  │
│                                                                 │
│  [ico] Provisionado no Mês ........................... R$ X,XX │  linha normal
│  ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱  │
│                                                                 │
│  ╔═════════════════════════════════════════════════════════════╗│
│  ║ [ico] Total Previsto no Mês               R$ X,XX (DESTAQUE)║│  linha-resumo
│  ║ Colchão + Provisionado                                       ║│  bg-primary/10
│  ╚═════════════════════════════════════════════════════════════╝│
│                                                                 │
│  [ico] Pendentes ..................................... R$ X,XX │  linha normal
│  ▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱  │
│                                                                 │
│  [ico] Quebra ........................................ R$ X,XX │  linha normal
│  ▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱  │
└─────────────────────────────────────────────────────────────────┘
```

Proporções verticais aproximadas dentro do `flex-col` do conteúdo:
- 4 linhas normais (1, 2, 4, 5): cada uma com `flex: 1` (peso 1)
- 1 linha-resumo (3): `flex: 1.3` (peso 1,3) + `bg-primary/10`, borda sutil `border-primary/30`, sem barra de progresso, valor em fonte maior (`text-base xl:text-lg`)
- Mesmos tamanhos responsivos já aplicados em `lg`/`xl`/`2xl` (ícone, fonte, padding) — sem alterar densidade adaptativa.

### Mudanças por arquivo

1. **`src/components/dashboard/Visao360Card.tsx`**
   - Adicionar props `colchao: number` e `provisionado: number` (renomear o atual `provisionado` se necessário) e manter `pendentes`, `quebra`.
   - Remover o cálculo "Provisionado no Mês" baseado no nome antigo, ajustar para receber os 5 valores conforme tabela.
   - Renderizar 4 linhas normais + a linha-resumo (Total Previsto = colchao + provisionado) com layout descrito.
   - `maxValue` calculado só sobre `[colchao, provisionado, pendentes, quebra]`.
   - Importar ícones extras necessários (`Wallet`, `Layers` ou `Sigma`).

2. **`src/pages/DashboardPage.tsx`**
   - Passar `colchao={stats?.total_projetado ?? 0}` e `provisionado={stats?.total_negociado ?? 0}` para o `Visao360Card` (hoje só passa `provisionado`, `pendentes`, `quebra`).
   - **Remover** a prop `colchao` do `DashboardMetaCard` (deixa de ser exibida no card de Meta, evitando duplicidade).

3. **`src/components/dashboard/DashboardMetaCard.tsx`**
   - Remover o chip "Colchão" no canto superior esquerdo (linhas ~113-127) e a prop `colchao`.
   - Manter o restante do card (gauge, footer Recebido/Faltam) intacto.

### Identidade visual

- Cores via tokens semânticos (`--primary`, `--warning`, `--destructive`); nada hardcoded.
- Mesmo padrão de "ícone em quadrado tinted + label + valor à direita + barra fina" já usado hoje.
- Linha-resumo segue o mesmo idioma do chip "Colchão" atual (fundo `primary/10`, borda `primary/30`, valor em destaque).
- Tipografia, spacing e responsividade seguem o sistema adaptativo (`lg`/`xl`/`2xl`) já existente.

### Fora deste plano

- Mudança no RPC do dashboard ou em qualquer cálculo no backend — todos os valores já vêm do `get_dashboard_stats_v2`.
- Mudança nos demais cards (Meta continua igual, só perde o chip Colchão).
- Mudança na ordem/visibilidade de blocos do dashboard.
