

# Plano: Corrigir persistência do mapeamento de tabulações

## Problema

O `handleSaveMap` usa `...settings` do contexto do tenant para construir o objeto de settings atualizado. Porém o contexto **nunca é recarregado** após qualquer save — nem após salvar credenciais, nem após salvar o mapeamento.

Isso causa dois bugs:

1. **Sobrescrita de dados**: Se o usuário salva credenciais e depois salva o mapeamento, o `settings` usado no spread ainda é o antigo (sem as credenciais). O mapeamento é salvo mas as credenciais são apagadas da coluna `settings`.

2. **Dados não aparecem ao recarregar**: Mesmo que o save funcione, ao navegar para outra página e voltar, o `tenant` do contexto pode estar desatualizado.

O mesmo problema afeta `handleSave` (credenciais): se o mapeamento já foi salvo, salvar credenciais sobrescreve o mapeamento.

## Correção

### `src/components/integracao/ThreeCPlusTab.tsx`

1. Importar `refetch` do `useTenant()`
2. Em `handleSave` (credenciais): após o update bem-sucedido, chamar `await refetch()`
3. Em `handleSaveMap` (mapeamento): 
   - Antes de salvar, buscar o `settings` mais recente do banco (em vez de usar o do contexto)
   - Após o update, chamar `await refetch()`

A busca fresca garante que não sobrescreva dados salvos por outra operação:

```typescript
const handleSaveMap = async () => {
  // Buscar settings frescos do banco
  const { data: freshTenant } = await supabase
    .from("tenants").select("settings").eq("id", tenant.id).single();
  const freshSettings = (freshTenant?.settings as Record<string,any>) || {};
  
  await supabase.from("tenants").update({
    settings: { ...freshSettings, threecplus_disposition_map: dispositionMap }
  }).eq("id", tenant.id);
  
  await refetch();
};
```

Aplicar o mesmo padrão no `handleSave` de credenciais.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/integracao/ThreeCPlusTab.tsx` | Buscar settings frescos antes de salvar; chamar `refetch()` após cada save |

