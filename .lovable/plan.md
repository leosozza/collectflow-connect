

# Plano: Toast persistente com botão Copiar Log

## Problema
O `toast.success()` na linha 171 desaparece automaticamente após poucos segundos. O usuário quer que fique na tela até ser fechado manualmente.

## Solução

Substituir `toast.success(...)` por `toast()` com `duration: Infinity` e conteúdo customizado contendo:
- Mensagem do resultado (X atualizados, Y não encontrados)
- Botão **"Copiar Log"** inline que copia o log formatado para o clipboard
- Botão **X** para fechar (nativo do sonner com `duration: Infinity` + `dismissible: true`)

```ts
toast(
  `Higienização concluída! ${enriched} atualizados, ${failed} não encontrados.`,
  {
    duration: Infinity,
    dismissible: true,
    action: {
      label: "Copiar Log",
      onClick: () => { /* clipboard logic */ }
    },
  }
);
```

## Arquivo modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/carteira/EnrichmentConfirmDialog.tsx` | Toast persistente com action "Copiar Log" |

