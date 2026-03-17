

# Fix: Categorização da Chamada — seed defaults + remover slug

## Problemas identificados

1. **DispositionPanel** usa lógica "se tem registros no banco → usa só esses, senão → usa defaults hardcoded". Ao criar 1 registro, os 5 defaults somem.
2. **CallDispositionTypesTab** mostra defaults como badges estáticas (não editáveis) quando não há registros no banco, e ao criar 1 registro custom, só aparece esse.
3. O campo **slug/key** é exposto ao usuário sem necessidade — gera confusão visual.

## Solução

### 1. Seed automático dos defaults no banco
Quando o tenant acessar a aba de Categorização e não tiver nenhum registro na tabela `call_disposition_types`, o sistema insere automaticamente os 5 defaults como registros editáveis no banco. Assim:
- O tenant sempre trabalha com registros do banco (editáveis)
- Criar uma nova categorização **adiciona** ao conjunto existente, sem remover as outras

**`CallDispositionTypesTab.tsx`**:
- Ao detectar `types.length === 0` e `tenantId`, chamar mutation que insere os 5 defaults via `createDispositionType`
- Após seed, invalidar query para recarregar
- Remover a seção de "Padrões do Sistema" (badges estáticas) — agora tudo é editável na tabela

### 2. Remover campo slug do formulário
- O campo "Chave (slug)" será removido do Dialog de criação/edição
- A key será gerada automaticamente a partir do label (já existe o `slugify`)
- O usuário não precisa ver nem editar esse campo

### 3. DispositionPanel — remover lógica de fallback
- Como agora sempre haverá registros no banco (seed automático), simplificar o `useMemo` para usar apenas `dbTypes`
- Manter fallback nos defaults hardcoded apenas como safety net caso a query falhe

## Arquivos modificados

- **`src/components/cadastros/CallDispositionTypesTab.tsx`**: seed automático + remover campo slug do dialog + remover seção badges estáticas
- **`src/components/atendimento/DispositionPanel.tsx`**: simplificar lógica (minor)
- **`src/services/dispositionService.ts`**: adicionar função `seedDefaultDispositionTypes(tenantId)` que insere os 5 defaults

