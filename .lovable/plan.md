

# Melhoria Visual do Menu de Telefonia

## Problemas identificados (da screenshot)

1. **Titulo "Telefonia"** no header esta pequeno (`text-sm`) — precisa ser maior como as demais paginas
2. **Botoes de grupo** (Dashboard, Campanhas, Chamadas, Controle) ocupam toda a largura com `grid-cols-4` — precisam ser menores e alinhados a esquerda
3. **Sub-abas** estao com estilo "apagado" — precisam de mais destaque visual

## Alteracoes

### 1. Header — Titulo maior (`AppLayout.tsx`)
- Mudar o titulo de `text-sm` para `text-lg font-bold` para a rota `/contact-center/telefonia`, igualando ao padrao das demais paginas

### 2. Botoes de grupo — Compactos e alinhados a esquerda (`ThreeCPlusPanel.tsx`)
- Trocar `grid grid-cols-4 gap-2` por `flex items-center gap-2` — botoes ficam com largura automatica, agrupados a esquerda
- Reduzir padding dos botoes de `px-4 py-3` para `px-3 py-2`
- Reduzir texto de `text-sm` para `text-xs`
- Icones menores: `w-3.5 h-3.5`

### 3. Sub-abas — Mais destaque visual (`ThreeCPlusPanel.tsx`)
- Aba ativa: adicionar fundo mais forte `bg-primary/20 text-primary font-semibold border border-primary/40`
- Abas inativas: `text-muted-foreground/80` com `border border-transparent` para manter alinhamento
- Separador visual (linha fina) entre os grupos e as sub-abas

## Resumo

| Arquivo | Mudanca |
|---|---|
| `AppLayout.tsx` | Titulo "Telefonia" maior (text-lg font-bold) |
| `ThreeCPlusPanel.tsx` | Botoes de grupo compactos + flex a esquerda; sub-abas com mais destaque |

