

# Plano: Corrigir seta de colapsar campanhas

## Causa raiz

O `campaigns.map` retorna um React Fragment (`<>...</>`) sem `key`. Quando se usa Fragment sem key numa lista, o React não consegue reconciliar corretamente os elementos, quebrando o toggle de expansão. O `key` está no `TableRow` interno, mas o Fragment pai precisa dele.

## Correção

**Arquivo**: `src/components/contact-center/threecplus/CampaignOverview.tsx`

Linha 97: Trocar `<>` por `<Fragment key={c.id}>` (importando `Fragment` de React).

```tsx
// De:
<>
  <TableRow key={c.id} ...>

// Para:
<Fragment key={c.id}>
  <TableRow ...>
```

E fechar com `</Fragment>` na linha 199.

Remover o `key={c.id}` do `TableRow` (linha 99) e o `key={\`${c.id}-detail\`}` do segundo `TableRow` (linha 160) — não são mais necessários pois o Fragment pai já tem a key.

| Arquivo | Mudança |
|---|---|
| `src/components/contact-center/threecplus/CampaignOverview.tsx` | `<>` → `<Fragment key={c.id}>` |

