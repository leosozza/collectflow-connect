## Remover toast ao inserir variável no editor de documentos

Quando o usuário clica em uma variável (ex.: `{tabela_parcelas}`) dentro do editor de modelos de documento do credor, hoje aparece um toast "Variável inserida: ... Também copiada para a área de transferência." Isso polui a tela a cada clique.

### Mudança
**Arquivo:** `src/components/cadastros/CredorDocumentTemplates.tsx` — função `handleInsertPlaceholder`.

Remover o `toast.success(...)` da função. A inserção no cursor e a cópia para o clipboard continuam funcionando normalmente, apenas em silêncio (sem notificação).

```ts
// Antes
await navigator.clipboard.writeText(key);
toast.success(`Variável inserida: ${key}`, {
  description: "Também copiada para a área de transferência.",
});

// Depois
await navigator.clipboard.writeText(key);
// (sem toast)
```

Nenhuma outra mudança. Comportamento de inserção e fallback de `execCommand("copy")` permanecem.
