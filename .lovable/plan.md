
# Otimizacao da Pagina Analytics

## Mudancas nos KPIs

### Substituicoes e reordenacao:
1. **Remover** "Tempo Medio Cobranca"
2. **Adicionar** "Total Inadimplencia" (soma de `valor_parcela` dos pendentes) -- sera o **primeiro card** da esquerda
3. Ordem final dos 4 KPIs: **Total Inadimplencia** | **Taxa de Recuperacao** | **Ticket Medio** | **Total Recebido**

## Taxa de Conversao da Carteira (nao mais por operador)

- O grafico de barras "Taxa de Conversao por Operador" sera substituido por um **indicador unico da carteira inteira**
- Calculo: de todos os clientes que tiveram contato (status != pendente, ou com operator_id atribuido), quantos foram convertidos (status = pago)
- Exibido como um card com barra de progresso ou gauge simples dentro do espaco do grafico atual

## Top 5 Maiores Credores (substituir Devedores)

- Agrupar por `credor` em vez de `cpf`
- Somar `valor_parcela` dos pendentes por credor
- Exibir nome do credor e valor total pendente

## Tooltips de explicacao em cada quadro

- Adicionar um icone de comentario (MessageCircle) discreto no canto superior direito de cada card/quadro
- Ao passar o mouse, exibir um `Tooltip` com explicacao simples da funcao daquele quadro
- Usar o componente `Tooltip` ja existente no projeto (`@radix-ui/react-tooltip`)

## Barra superior otimizada

Baseado na referencia enviada, a barra esta quebrando em 2 linhas. Otimizacao:
- Colocar titulo (seta + "Analytics") a esquerda
- Filtros e botoes de acao todos em **uma unica linha** a direita, sem quebra
- Botoes Excel e PDF como icones compactos (`size="icon"`) sem texto
- Reduzir largura dos selects para ficarem mais compactos

## Detalhes Tecnicos

### Arquivo modificado:
- `src/pages/AnalyticsPage.tsx`

### Alteracoes especificas:

**KPIs (linhas 108-118, 246-267):**
- Calcular `totalInadimplencia = pendentes.reduce((s, c) => s + Number(c.valor_parcela), 0)`
- Remover calculo de `tempoMedioLabel` / `paidOnTime`
- Reordenar cards: Inadimplencia, Recuperacao, Ticket Medio, Total Recebido
- Trocar icone Clock por AlertTriangle para Inadimplencia

**Taxa de Conversao (linhas 140-149, 288-303):**
- Substituir `operatorConversion` por calculo global: clientes com operator_id atribuido = "contatados"; desses, quantos ficaram "pago" = taxa
- Exibir como card grande com percentual e barra de progresso

**Top 5 Credores (linhas 158-167, 326-347):**
- Agrupar por `c.credor` em vez de `c.cpf`
- Exibir nome do credor + valor total pendente

**Tooltips (todos os cards/quadros):**
- Importar `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` e `MessageCircle`
- Adicionar icone + tooltip no header de cada secao com textos explicativos

**Header (linhas 198-243):**
- Layout em linha unica: titulo a esquerda, filtros + acoes a direita
- Botoes Excel/PDF como `size="icon"` sem label
- Selects com larguras reduzidas
