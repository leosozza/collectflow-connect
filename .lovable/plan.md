

# Plano: Corrigir exibição de "Nome do Modelo" no atendimento

## Causa Raiz

O campo "Nome do Modelo" está armazenado na **coluna direta `model_name`** da tabela `clients` (valor: "Enzo Gabriel Lara Neuls"), mas a configuração de campo do atendimento referencia como `custom:nome_do_modelo`, fazendo o `getCustomFieldRenderer` buscar em `client.custom_data["nome_do_modelo"]` — que está vazio (`{}`).

A página de perfil (`ClientDetailPage`) funciona porque usa `client.model_name` diretamente.

## Solução

### `src/components/atendimento/ClientHeader.tsx`

1. Adicionar `model_name` ao `FIELD_RENDERERS` como campo estático — consolidando valores de múltiplos registros (como `ClientDetailHeader` faz):
```typescript
model_name: () => {
  const records = clientRecords.length > 0 ? clientRecords : [client];
  const names = [...new Set(records.map(r => r.model_name).filter(Boolean))].join(" / ");
  return { label: "Nome do Modelo", value: names || null, icon: Tag };
},
```

2. No `getCustomFieldRenderer`, adicionar fallback: se o `realKey` corresponder a uma coluna direta do client (como `model_name` mapeado de `nome_do_modelo`), usar o valor da coluna. Ou mais simples: mapear `custom:nome_do_modelo` → renderer `model_name`.

Abordagem escolhida: no método `renderField`, antes de chamar `getCustomFieldRenderer`, verificar se existe um mapeamento de alias `custom:nome_do_modelo` → `model_name` no FIELD_RENDERERS.

## Arquivo Afetado

| Arquivo | Mudança |
|---|---|
| `src/components/atendimento/ClientHeader.tsx` | Adicionar renderer `model_name` + mapeamento de `custom:nome_do_modelo` |

Nenhuma alteração em banco, serviços ou fluxos operacionais.

