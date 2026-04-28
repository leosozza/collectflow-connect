# Corrigir Diálogo "Gerar Nova API Key" — Selecionar Credor

O backend, a migration e o `apiKeyService` já suportam `credor_id` por chave. O que ficou faltando é a **UI**: o diálogo continua mostrando só o campo "Label", e a tabela de chaves não exibe o credor vinculado. Por isso o sistema não te perguntou.

## O que vou ajustar em `src/pages/ApiDocsPage.tsx`

### 1. Diálogo "Gerar Nova API Key"
Adicionar, abaixo do campo **Label da chave**, um novo campo:

- **Select "Credor"** com as opções:
  - `Todos os credores (chave do tenant)` → valor `__all__`
  - Lista de credores ativos do tenant (já carregados em `credores` no estado)

O state `newKeyCredorId` já existe (default `__all__`). Só falta renderizar o `<Select>` e usá-lo.

### 2. `handleGenerate`
Passar o credor selecionado para o service:

```ts
const credorId = newKeyCredorId === "__all__" ? null : newKeyCredorId;
const { rawToken, record } = await generateApiKey(
  tenant.id,
  profile.id,
  newKeyLabel || "Nova Chave",
  credorId,
);
```

E resetar `setNewKeyCredorId("__all__")` após gerar.

### 3. Tabela de chaves existentes
Adicionar a coluna **"Credor"** entre `Label` e `Prefixo`, exibindo:
- `key.credor_nome` quando a chave é escopada
- Badge `Todos` (cinza) quando `credor_id` é `null`

Isso organiza visualmente quais chaves pertencem a qual credor.

### 4. Mensagem ao gerar
No banner de sucesso (que mostra o token), incluir uma linha:
> "Esta chave está vinculada ao credor: **{nome}**" — ou — "Esta chave acessa **todos os credores** do tenant"

## Resultado

- Ao clicar em **+ Nova Chave**, o diálogo passa a ter os campos: **Label** + **Credor**.
- A tabela mostra claramente o escopo de cada chave já existente (incluindo a "Maxlist" antiga, que aparecerá como "Todos").
- Nenhuma chave existente quebra — `credor_id NULL` continua significando acesso amplo.

## Arquivos alterados
- `src/pages/ApiDocsPage.tsx` (única alteração necessária — service e edge function já estão prontos)
