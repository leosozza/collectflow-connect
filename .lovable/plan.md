
# Plano: Campos destacados sempre visíveis (mesmo sem valor)

## Causa Raiz

Duas linhas problemáticas:

1. **`InfoItem` (linha 39)**: `if (!value) return null` — o componente desaparece quando valor é nulo/vazio
2. **`renderField` (linha 215)**: `if (!value) return null` — filtra campos vazios antes mesmo de renderizar

Isso afeta tanto campos estáticos (tipo_devedor, etc.) quanto customizados.

## Solução

### `src/components/atendimento/ClientHeader.tsx`

1. **`InfoItem`** (linha 38-48): Remover o `if (!value) return null`. Quando `value` for falsy, exibir `"—"` como placeholder em cor `text-muted-foreground/60`.

2. **`renderField`** (linha 211-217): Transformar em função que aceita um parâmetro `forceRender: boolean`. Para highlighted fields, passar `true` (sempre renderiza). Para expanded fields, manter o comportamento atual de omitir vazios.

3. **Highlighted fields rendering** (linha 305): Usar `renderField(f, true)` — força renderização.

4. **Expanded fields rendering** (linha 322): Usar `renderField(f, false)` — omite vazios.

5. **`getCustomFieldRenderer`** (linha 176): Retornar o label correto mesmo quando valor é nulo — não retornar `value: null` impedirá a exibição, mas como o `renderField` com `forceRender` ignorará essa check, o campo aparecerá com placeholder.

## Arquivo Afetado

| Arquivo | Mudança |
|---|---|
| `src/components/atendimento/ClientHeader.tsx` | InfoItem com placeholder, renderField com forceRender |

Nenhuma alteração em banco, serviços, ou fluxos operacionais.
