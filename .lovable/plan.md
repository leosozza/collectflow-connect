# Plano: Sincronizar altura do bloco KPI unificado

## Problema
O bloco unificado da Coluna 1 (Acionados Hoje / Acordos do Dia / Acordos do Mês) ficou mais baixo que os 3 StatCards das Colunas 2 e 3, desalinhando os cards funcionais ("Agendados", "Parcelas Programadas", "Meta") logo abaixo.

## Mudança em `src/pages/DashboardPage.tsx`
Atualizar o container do bloco unificado para preencher exatamente a mesma altura dos 3 StatCards adjacentes:

- Adicionar `flex flex-col` no container externo
- Cada uma das 3 linhas usa `flex-1 min-h-[76px]` para dividir igualmente o espaço vertical
- Manter o empilhamento vertical (label em cima, valor embaixo) com `flex flex-col items-start justify-center`
- Padding `px-4 py-4`, label `text-[11px] uppercase`, valor `text-2xl font-bold`
- Manter `divide-y divide-border/60` entre as linhas

## Resultado
Os 3 cards ("Agendados", "Parcelas Programadas", "Meta") ficarão alinhados horizontalmente na mesma linha de base, sem alterar o espaço total ocupado pela seção superior de métricas.
