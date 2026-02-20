
## Problema: Formulário de Credor fecha ao sair da janela

### Causa raiz
O componente `<Sheet>` (Radix UI Dialog) fecha automaticamente quando detecta um clique ou interação **fora** da sua área. Isso é o comportamento padrão do Radix UI.

Quando o usuário:
1. Abre o formulário de Credor
2. Clica fora do navegador (ex: para copiar dados de outro app ou aba)
3. Retorna ao sistema

O foco volta ao documento e o Radix interpreta isso como "interação fora do dialog" → fecha o Sheet, perdendo todos os dados digitados.

### Solução
Adicionar `onInteractOutside={(e) => e.preventDefault()}` no `<SheetContent>` do `CredorForm.tsx`. Isso impede que qualquer clique ou interação fora do painel o feche.

### Arquivo alterado

**`src/components/cadastros/CredorForm.tsx` — linha 188:**

```tsx
// ANTES
<SheetContent className="w-full sm:max-w-2xl overflow-y-auto">

// DEPOIS
<SheetContent
  className="w-full sm:max-w-2xl overflow-y-auto"
  onInteractOutside={(e) => e.preventDefault()}
>
```

- 1 linha alterada
- O usuário ainda pode fechar o formulário pelos botões **Cancelar** ou **Salvar**, ou pelo **X** no canto superior direito
- Nenhum dado será perdido ao alternar entre aplicativos/abas

