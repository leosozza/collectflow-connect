

# Correcao das Barras de Rolagem

## Problema 1: Sidebar sem scroll
A `<nav>` do sidebar usa `flex-1` para ocupar o espaco disponivel, mas nao tem `overflow-auto`. Quando ha muitos itens de menu (admin tem 13+ itens), os itens ficam cortados ou empurram o layout sem possibilidade de rolar. A barra de rolagem deve ser invisivel (thin/auto-hide) para manter o visual limpo.

## Problema 2: Scrollbar da pagina principal incorreta
O arquivo `src/App.css` define estilos no `#root` (`max-width: 1280px`, `margin: 0 auto`, `padding: 2rem`) que conflitam com o layout full-screen do `AppLayout`. Isso causa problemas de largura e posicionamento da barra de rolagem.

## Solucao

### 1. Sidebar - Adicionar scroll invisivel na nav
No `src/components/AppLayout.tsx`, alterar a `<nav>` (linha 89):
- De: `className="flex-1 px-2 py-4 space-y-1"`
- Para: `className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin"`

Adicionar classe utilitaria CSS em `src/index.css` para esconder a scrollbar visualmente mas manter funcionalidade:
```css
@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }
  .scrollbar-thin:hover {
    scrollbar-color: hsl(var(--sidebar-border)) transparent;
  }
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 2px;
  }
  .scrollbar-thin:hover::-webkit-scrollbar-thumb {
    background: hsl(var(--sidebar-border));
  }
}
```

### 2. Limpar App.css
Remover todo o conteudo de `src/App.css` (ou remover o arquivo se nao for importado em lugar critico). Os estilos la sao restos do template Vite e conflitam com o layout.

### Arquivos modificados
- `src/components/AppLayout.tsx` - adicionar `overflow-y-auto scrollbar-thin` na nav
- `src/index.css` - adicionar classes utilitarias para scrollbar invisivel
- `src/App.css` - limpar conteudo (estilos legados do template Vite)
