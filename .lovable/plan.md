

# Melhoria Visual da Telefonia — Layout Padrão

## Objetivo
Alinhar a página de Telefonia ao padrão visual das demais páginas (Carteira, Clientes), com título grande, descrição, e navegação mais espaçada e organizada.

## Referência (screenshot Carteira)
- Título `text-2xl font-bold` + descrição `text-sm text-muted-foreground` abaixo
- Espaçamento generoso entre header, navegação e conteúdo

## Alterações

### `ThreeCPlusPanel.tsx`
1. **Adicionar header de página** no topo do componente (dentro do painel, não no AppLayout):
   - `<h1 className="text-2xl font-bold">Telefonia</h1>`
   - `<p className="text-sm text-muted-foreground">Gerencie campanhas, operadores e chamadas</p>`

2. **Aumentar espaçamento** geral de `space-y-4` para `space-y-6`

3. **Botões de grupo**: manter compactos e à esquerda, mas com `gap-3` ao invés de `gap-2` para mais respiro

4. **Sub-abas**: aumentar `gap-2` entre elas e adicionar `py-2` ao container para mais espaço vertical

5. **Separador visual**: manter a linha entre grupos e sub-abas com `my-1` de margem

### `AppLayout.tsx`
- Nenhuma alteração — o título no header pode permanecer como está (as demais páginas também têm título no header + título dentro da página)

