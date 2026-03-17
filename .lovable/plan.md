

# Ajustar botões WhatsApp + Formalizar Acordo no ClientHeader

## Mudanças em `src/components/atendimento/ClientHeader.tsx`

### 1. Usar o mesmo ícone SVG de WhatsApp da Carteira
Copiar o componente `WhatsAppIcon` do `ClientDetailHeader.tsx` (SVG oficial do WhatsApp) e usar no lugar do `MessageCircle` genérico. Estilizar com `bg-green-500/10 text-green-500 hover:bg-green-500/20` — mesmo visual do perfil na carteira.

### 2. Mover botões para a mesma linha dos stats financeiros
Remover a `div` separada de botões centralizados (linhas 212-230). Inserir os botões **dentro** da linha principal do header (linha 169), ao lado dos financial stats, para ficarem na mesma linha sem aumentar o card.

### 3. Reduzir fonte do botão Formalizar Acordo
Usar `size="sm"` e `text-sm` ao invés de `size="lg"` e `text-base`, para caber na linha e ficar alinhado com os outros elementos.

### Layout resultante (linha principal):
```
[Avatar] [Nome + CPF/Credor] [Em Aberto | Total Pago | Atraso] [🟢WhatsApp] [Formalizar Acordo]
```

Tudo em uma única linha flex, sem linha extra de botões.

