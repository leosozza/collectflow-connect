

# Plano: Unificar visual do badge "Acordo Vigente" nos 3 locais

## Situação atual

O texto "Acordo Vigente" já aparece corretamente nos 3 locais. O problema é que cada um renderiza o badge com estilo diferente:

- `/acordos` → `bg-orange-100 text-orange-800` (cor de "pending")
- `/carteira/{cpf}` → `variant="outline"` (badge outline cinza)
- `/carteira` → cor dinâmica da tabela `tipos_status` (verde, conforme screenshot)

O screenshot mostra que o visual desejado é o da carteira: **badge verde com borda**, como configurado no cadastro de status.

## Correção

Alinhar os badges de `/acordos` e `/carteira/{cpf}` ao estilo verde usado na carteira.

### 1. `src/components/acordos/AgreementsList.tsx`
- Alterar `statusColors.pending` de `bg-orange-100 text-orange-800` para `bg-green-50 text-green-700 border border-green-300` (verde claro, consistente com o screenshot)

### 2. `src/pages/ClientDetailPage.tsx`
- Alterar `statusVariantMap.pending` para usar estilo customizado verde em vez de `variant="outline"` genérico
- Aplicar a mesma cor verde: `bg-green-50 text-green-700 border border-green-300`

### Resultado
Os 3 locais exibirão "Acordo Vigente" com o mesmo visual verde, sem alterar lógica, nomenclaturas ou fontes de dados.

### Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/components/acordos/AgreementsList.tsx` | Cor do badge `pending` → verde |
| `src/pages/ClientDetailPage.tsx` | Estilo do badge `pending` → verde |

