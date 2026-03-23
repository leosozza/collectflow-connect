

# Plano: Corrigir mapeamento de tabulações na aba de integração

## Problemas identificados

### 1. Mapeamento usa lista hardcoded em vez das tabulações reais do tenant
A seção "Mapeamento de Tabulações" em `ThreeCPlusTab.tsx` (linha 494) usa `DISPOSITION_TYPES` — um objeto hardcoded com apenas 5 itens genéricos. O tenant tem 10 tabulações configuradas na tabela `call_disposition_types`, mas nenhuma delas aparece no mapeamento.

### 2. Qualificações só carregam após "Testar Conexão"
O `loadQualifications` só roda quando `connected === true` (após clicar "Testar Conexão"). Se o usuário já tem credenciais salvas e abre a aba, as qualificações não aparecem.

### 3. A sincronização cria qualificações na 3CPlus mas o mapeamento manual não as mostra
O `syncDispositionsTo3CPlus` cria a lista "RIVO Tabulações" na 3CPlus e gera o `disposition_map` automaticamente. Mas o mapeamento manual na aba de integração busca qualificações de outra fonte (primeira lista encontrada ou `qualification_list_id` de uma campanha), que pode não ser a lista "RIVO Tabulações".

## Correções

### `src/components/integracao/ThreeCPlusTab.tsx`

1. **Trocar `DISPOSITION_TYPES` pelas tabulações reais do tenant** — Buscar da tabela `call_disposition_types` via query (mesmo padrão do `CallDispositionTypesTab`)

2. **Carregar qualificações automaticamente** — Se o tenant já tem `threecplus_domain` e `threecplus_api_token` salvos, carregar qualificações ao montar o componente (sem exigir "Testar Conexão")

3. **Priorizar a lista "RIVO Tabulações"** — No `loadQualifications`, buscar todas as listas e priorizar a que tem nome "RIVO Tabulações". Incluir também as qualificações padrão do sistema (IDs negativos: -2, -3, -4, -5) como opções de mapeamento

4. **Mostrar o mapeamento automático existente** — Se o tenant já tem `threecplus_disposition_map` no settings, mostrar o mapeamento atual mesmo sem carregar qualificações da API (exibir os IDs mapeados)

5. **Incluir qualificações padrão do sistema** — As qualificações com ID negativo (-2 Não qualificada, -3 Caixa Postal, -4 Mudo, -5 Limite de tempo excedido) são nativas da 3CPlus e devem aparecer como opções de mapeamento. Adicioná-las à lista de qualificações disponíveis

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/components/integracao/ThreeCPlusTab.tsx` | Buscar tabulações do banco, carregar qualificações automaticamente, priorizar lista RIVO, incluir qualificações padrão do sistema |

