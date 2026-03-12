

# Plano: Manter dialog aberto após higienização

## Problema

Na linha 214, `onComplete()` é chamado imediatamente após o toast, o que faz o componente pai fechar o dialog. O usuário não consegue ver a tabela de resultados.

## Solução

Mover `onComplete()` para ser chamado apenas quando o usuário clica "Fechar" (linha 325), não automaticamente após o processamento.

| Arquivo | Alteração |
|---------|-----------|
| `src/components/carteira/EnrichmentConfirmDialog.tsx` | Remover `onComplete()` da linha 214; chamar `onComplete()` no botão "Fechar" (linha 325) |

Botão Fechar ficará:
```tsx
<Button onClick={() => { onComplete(); onOpenChange(false); }}>Fechar</Button>
```

