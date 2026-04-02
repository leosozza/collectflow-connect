

# Plano: Corrigir contagem nos botões WhatsApp/Discador/Higienizar

## Causa Raiz

A contagem nos botões é calculada assim:

```typescript
const selectedClients = displayClients.filter((c) => selectedIds.has(c.id));
const uniqueSelectedCpfs = new Set(selectedClients.map(c => c.cpf.replace(/\D/g, ""))).size;
```

`displayClients` contém apenas os registros da **página atual** (ex: 500). Quando o usuário clica "Selecionar todos os N filtrados", `selectedIds` recebe milhares de IDs via RPC, mas o `.filter()` só encontra os que estão em `displayClients`. Resultado: o contador mostra o tamanho da página, não o total selecionado.

## Solução

Quando `selectAllFiltered === true`, usar `selectedIds.size` diretamente como contagem nos botões, já que nesse cenário todos os IDs filtrados já foram carregados e representam clientes únicos por CPF (a RPC `get_carteira_grouped` já agrupa por CPF).

Concretamente:

```typescript
const selectedCount = selectAllFiltered
  ? selectedIds.size
  : new Set(displayClients.filter(c => selectedIds.has(c.id)).map(c => c.cpf.replace(/\D/g, ""))).size;
```

Substituir `uniqueSelectedCpfs` por `selectedCount` nos 4 botões (WhatsApp, Discador, Atribuir, Higienizar).

## Arquivo Afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/CarteiraPage.tsx` | Calcular contagem correta quando `selectAllFiltered` está ativo |

