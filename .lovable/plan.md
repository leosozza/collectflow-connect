

## Plano: Adicionar "Notificacao Extrajudicial" e layout vertical nos Documentos

### Problema
1. O array `DOCUMENT_TYPES` na linha 17 tem apenas 4 documentos -- falta `template_notificacao_extrajudicial` (que ja existe na tabela `credores`).
2. A query na linha 38 nao inclui `template_notificacao_extrajudicial` no SELECT.
3. O layout usa `grid-cols-1 sm:grid-cols-2` (2 colunas em telas maiores). O usuario quer todos empilhados verticalmente.

### Mudancas

**Arquivo: `src/components/client-detail/ClientDocuments.tsx`**

1. Adicionar ao array `DOCUMENT_TYPES` (linha 22):
   ```
   { key: "template_notificacao_extrajudicial", label: "Notificacao Extrajudicial", icon: "⚖️" }
   ```

2. Adicionar `template_notificacao_extrajudicial` ao SELECT da query (linha 38).

3. Trocar o grid de `grid-cols-1 sm:grid-cols-2` para `flex flex-col` (linha 89) para exibir todos os documentos um abaixo do outro.

